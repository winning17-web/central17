import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-dark-bg">
      <header className="bg-darker-bg p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <Image 
              src="/images/gc-logo.png" 
              alt="Gaming Central Logo" 
              width={50} 
              height={50}
              className="h-10 w-auto"
            />
            <span className="text-gold font-bold text-xl">Gaming Central</span>
          </Link>
          
          <nav>
            <ul className="flex gap-6">
              <li>
                <Link href="/tournaments" className="text-white hover:text-electric-blue transition-colors">
                  Tournaments
                </Link>
              </li>
              <li>
                <Link href="/leaderboard" className="text-white hover:text-electric-blue transition-colors">
                  Leaderboard
                </Link>
              </li>
              <li>
                <Link href="/profile" className="text-white hover:text-electric-blue transition-colors">
                  Profile
                </Link>
              </li>
            </ul>
          </nav>
          
          <button className="btn-primary">
            Connect Wallet
          </button>
        </div>
      </header>
      
      <main className="flex-grow">
        {children}
      </main>
      
      <footer className="bg-darker-bg p-6 mt-auto">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <Image 
                src="/images/gc-logo.png" 
                alt="Gaming Central Logo" 
                width={40} 
                height={40}
                className="h-8 w-auto"
              />
              <span className="text-gold font-bold">Gaming Central</span>
            </div>
            
            <div className="flex gap-6">
              <Link href="/terms" className="text-text-secondary hover:text-white transition-colors">
                Terms of Service
              </Link>
              <Link href="/privacy" className="text-text-secondary hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="/contact" className="text-text-secondary hover:text-white transition-colors">
                Contact Us
              </Link>
            </div>
          </div>
          
          <div className="mt-6 text-center text-text-secondary text-sm">
            &copy; {new Date().getFullYear()} Gaming Central. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
