import Image from 'next/image';
import Link from 'next/link';

export default function Header() {
  return (
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
  );
}
