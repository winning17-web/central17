/**
 * PlayCoin Expiration Service
 * 
 * This module implements the 7-day self-destruct feature for PlayCoins
 * to maintain currency value and encourage active participation.
 */

import mongoose from 'mongoose';
import { IPlayCoin, PlayCoin } from './PlayCoinService';

/**
 * PlayCoin Expiration Service Implementation
 */
class PlayCoinExpirationService {
  private expirationDays: number = 7; // Default expiration period in days
  
  /**
   * Set the expiration period for PlayCoins
   */
  setExpirationPeriod(days: number): void {
    if (days < 1) {
      throw new Error('Expiration period must be at least 1 day');
    }
    this.expirationDays = days;
    console.log(`PlayCoin expiration period set to ${days} days`);
  }
  
  /**
   * Get the current expiration period
   */
  getExpirationPeriod(): number {
    return this.expirationDays;
  }
  
  /**
   * Process expiration for a specific user's PlayCoins
   */
  async processUserExpiration(userId: string): Promise<{
    previousBalance: number;
    newBalance: number;
    expiredAmount: number;
    expirationTransactions: {
      amount: number;
      timestamp: Date;
      originalEarnTimestamp: Date;
    }[];
  }> {
    try {
      // Get user's PlayCoin account
      const userCoin = await PlayCoin.findOne({ userId });
      
      if (!userCoin || userCoin.balance === 0) {
        return {
          previousBalance: 0,
          newBalance: 0,
          expiredAmount: 0,
          expirationTransactions: []
        };
      }
      
      const previousBalance = userCoin.balance;
      const now = new Date();
      const expirationThreshold = new Date(now.getTime() - (this.expirationDays * 24 * 60 * 60 * 1000));
      
      // Find earn transactions older than the expiration threshold that haven't been spent or expired
      const earnTransactions = userCoin.transactions
        .filter(t => t.type === 'earn' && t.timestamp < expirationThreshold);
      
      // Calculate total amount to expire
      let totalToExpire = 0;
      const expirationTransactions = [];
      
      for (const earnTransaction of earnTransactions) {
        // Check if this earn transaction has been fully spent
        // This is a simplified approach; a real implementation would track individual coin spending
        const amountToExpire = earnTransaction.amount;
        
        if (amountToExpire > 0) {
          totalToExpire += amountToExpire;
          
          expirationTransactions.push({
            amount: amountToExpire,
            timestamp: now,
            originalEarnTimestamp: earnTransaction.timestamp
          });
        }
      }
      
      // Cap expiration at current balance
      const expiredAmount = Math.min(totalToExpire, userCoin.balance);
      
      if (expiredAmount > 0) {
        // Add expiration transaction
        userCoin.transactions.push({
          type: 'expire',
          amount: expiredAmount,
          source: 'ad_watch', // Default source for expiration
          timestamp: now,
          metadata: {
            reason: '7-day expiration',
            expirationThreshold: expirationThreshold.toISOString()
          }
        });
        
        // Update balance
        userCoin.balance -= expiredAmount;
        userCoin.lastUpdated = now;
        
        await userCoin.save();
      }
      
      return {
        previousBalance,
        newBalance: userCoin.balance,
        expiredAmount,
        expirationTransactions
      };
    } catch (error) {
      console.error(`Error processing expiration for user ${userId}:`, error);
      throw error;
    }
  }
  
  /**
   * Process expiration for all users' PlayCoins
   */
  async processAllExpirations(): Promise<{
    processedUsers: number;
    totalExpiredAmount: number;
    successCount: number;
    failureCount: number;
  }> {
    try {
      // Get all users with positive balance
      const users = await PlayCoin.find({ balance: { $gt: 0 } });
      
      let totalExpiredAmount = 0;
      let successCount = 0;
      let failureCount = 0;
      
      // Process each user
      for (const user of users) {
        try {
          const result = await this.processUserExpiration(user.userId);
          totalExpiredAmount += result.expiredAmount;
          successCount++;
        } catch (error) {
          console.error(`Failed to process expiration for user ${user.userId}:`, error);
          failureCount++;
        }
      }
      
      return {
        processedUsers: users.length,
        totalExpiredAmount,
        successCount,
        failureCount
      };
    } catch (error) {
      console.error('Error processing all expirations:', error);
      throw error;
    }
  }
  
  /**
   * Schedule regular expiration processing
   */
  scheduleExpirationProcessing(intervalHours: number = 24): NodeJS.Timeout {
    console.log(`Scheduling PlayCoin expiration processing every ${intervalHours} hours`);
    
    // Run immediately once
    this.processAllExpirations()
      .then(result => {
        console.log(`Initial expiration processing complete:`, result);
      })
      .catch(error => {
        console.error('Error in initial expiration processing:', error);
      });
    
    // Schedule regular processing
    const intervalMs = intervalHours * 60 * 60 * 1000;
    const timer = setInterval(() => {
      this.processAllExpirations()
        .then(result => {
          console.log(`Scheduled expiration processing complete:`, result);
        })
        .catch(error => {
          console.error('Error in scheduled expiration processing:', error);
        });
    }, intervalMs);
    
    return timer;
  }
  
  /**
   * Get expiration forecast for a user
   */
  async getUserExpirationForecast(userId: string): Promise<{
    currentBalance: number;
    expiringInOneDay: number;
    expiringInThreeDays: number;
    expiringInSevenDays: number;
    expirationSchedule: {
      date: Date;
      amount: number;
    }[];
  }> {
    try {
      // Get user's PlayCoin account
      const userCoin = await PlayCoin.findOne({ userId });
      
      if (!userCoin || userCoin.balance === 0) {
        return {
          currentBalance: 0,
          expiringInOneDay: 0,
          expiringInThreeDays: 0,
          expiringInSevenDays: 0,
          expirationSchedule: []
        };
      }
      
      const now = new Date();
      const oneDayFromNow = new Date(now.getTime() + (1 * 24 * 60 * 60 * 1000));
      const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));
      const sevenDaysFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
      
      // Get all earn transactions
      const earnTransactions = userCoin.transactions
        .filter(t => t.type === 'earn')
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      // Calculate expiration schedule
      const expirationSchedule: { date: Date; amount: number; }[] = [];
      let expiringInOneDay = 0;
      let expiringInThreeDays = 0;
      let expiringInSevenDays = 0;
      
      for (const transaction of earnTransactions) {
        const expirationDate = new Date(transaction.timestamp.getTime() + (this.expirationDays * 24 * 60 * 60 * 1000));
        
        // Skip if already expired
        if (expirationDate <= now) continue;
        
        // Add to schedule
        const existingEntry = expirationSchedule.find(e => 
          e.date.getFullYear() === expirationDate.getFullYear() &&
          e.date.getMonth() === expirationDate.getMonth() &&
          e.date.getDate() === expirationDate.getDate()
        );
        
        if (existingEntry) {
          existingEntry.amount += transaction.amount;
        } else {
          expirationSchedule.push({
            date: expirationDate,
            amount: transaction.amount
          });
        }
        
        // Update expiration forecasts
        if (expirationDate <= oneDayFromNow) {
          expiringInOneDay += transaction.amount;
        }
        
        if (expirationDate <= threeDaysFromNow) {
          expiringInThreeDays += transaction.amount;
        }
        
        if (expirationDate <= sevenDaysFromNow) {
          expiringInSevenDays += transaction.amount;
        }
      }
      
      // Sort schedule by date
      expirationSchedule.sort((a, b) => a.date.getTime() - b.date.getTime());
      
      return {
        currentBalance: userCoin.balance,
        expiringInOneDay,
        expiringInThreeDays,
        expiringInSevenDays,
        expirationSchedule
      };
    } catch (error) {
      console.error(`Error getting expiration forecast for user ${userId}:`, error);
      throw error;
    }
  }
  
  /**
   * Notify users about upcoming expirations
   * This is a placeholder for integration with a notification system
   */
  async sendExpirationNotifications(thresholdDays: number = 1): Promise<{
    notificationsSent: number;
  }> {
    try {
      // Get all users with positive balance
      const users = await PlayCoin.find({ balance: { $gt: 0 } });
      let notificationsSent = 0;
      
      for (const user of users) {
        try {
          const forecast = await this.getUserExpirationForecast(user.userId);
          
          // Check if there are coins expiring within the threshold
          if (thresholdDays === 1 && forecast.expiringInOneDay > 0) {
            // Send notification (placeholder)
            console.log(`[NOTIFICATION] User ${user.userId}: ${forecast.expiringInOneDay} PlayCoins expiring within 24 hours`);
            notificationsSent++;
          } else if (thresholdDays === 3 && forecast.expiringInThreeDays > 0) {
            // Send notification (placeholder)
            console.log(`[NOTIFICATION] User ${user.userId}: ${forecast.expiringInThreeDays} PlayCoins expiring within 3 days`);
            notificationsSent++;
          }
        } catch (error) {
          console.error(`Failed to process notification for user ${user.userId}:`, error);
        }
      }
      
      return { notificationsSent };
    } catch (error) {
      console.error('Error sending expiration notifications:', error);
      throw error;
    }
  }
  
  /**
   * Schedule regular notification sending
   */
  scheduleExpirationNotifications(intervalHours: number = 24): NodeJS.Timeout {
    console.log(`Scheduling PlayCoin expiration notifications every ${intervalHours} hours`);
    
    // Schedule regular notifications
    const intervalMs = intervalHours * 60 * 60 * 1000;
    const timer = setInterval(() => {
      // Send 1-day notifications
      this.sendExpirationNotifications(1)
        .then(result => {
          console.log(`1-day expiration notifications sent:`, result);
        })
        .catch(error => {
          console.error('Error sending 1-day notifications:', error);
        });
      
      // Send 3-day notifications
      this.sendExpirationNotifications(3)
        .then(result => {
          console.log(`3-day expiration notifications sent:`, result);
        })
        .catch(error => {
          console.error('Error sending 3-day notifications:', error);
        });
    }, intervalMs);
    
    return timer;
  }
}

// Create service instance
const playCoinExpirationService = new PlayCoinExpirationService();

export {
  playCoinExpirationService,
  PlayCoinExpirationService
};
