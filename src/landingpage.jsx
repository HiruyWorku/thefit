import React, {useState} from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { signUpUser, signInUser, signOutUser } from './auth';

export default function LandingPage() {
  // Continuous floating animation for hero images
  const floatAnimation = (delay, reverse = false) => ({
    y: [0, reverse ? 15 : -15, 0],
    rotate: [0, reverse ? -2 : 2, 0],
    transition: {
      duration: 5 + delay,
      repeat: Infinity,
      ease: "easeInOut",
      delay: delay
    }
  });

  // Staggered list animations
  const listContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const listItem = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#1C2321] font-sans selection:bg-[#1A365D] selection:text-[#F9F8F6] overflow-x-hidden">
      
      {/* Animated Background Glow */}
      <motion.div 
        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="fixed top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#1A365D]/5 blur-[120px] pointer-events-none -z-10"
      />

      {/* Navigation */}
      <nav className="relative z-10 flex justify-between items-center p-8 lg:px-16 border-b border-[#1A365D]/10">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          {/* Logo and App Name */}
          <img 
            src="/logo.png" 
            alt="thefit Logo" 
            className="h-12 w-auto object-contain" 
          />
          <span className="font-sans text-3xl font-black tracking-tighter text-[#1A365D]">
            thefit
          </span>
        </motion.div>
        
        <div className="flex gap-8 items-center">
          <motion.a 
            whileHover={{ y: -2 }}
            href="https://github.com/tandpfun/wardrobe" 
            target="_blank" 
            rel="noreferrer" 
            className="text-sm font-medium text-[#1C2321]/60 hover:text-[#1A365D] transition-colors"
          >
            GitHub
          </motion.a>
          <Link to="/app">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-[#1A365D] text-[#F9F8F6] px-7 py-3 rounded-full text-sm font-medium shadow-lg shadow-[#1A365D]/20 cursor-pointer"
            >
              Open Closet
            </motion.div>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative px-8 lg:px-16 pt-24 pb-32 flex flex-col items-center text-center">
        <motion.h2 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, type: "spring", bounce: 0.3 }}
          className="relative z-10 font-serif text-6xl md:text-7xl lg:text-8xl max-w-5xl leading-[1.1] text-[#1C2321]"
        >
          Your clothes, <br />
          <span className="italic text-[#1A365D] font-light">beautifully</span> organized.
        </motion.h2>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="relative z-10 mt-8 text-lg md:text-xl text-[#1C2321]/60 max-w-2xl font-light"
        >
          A smart digital wardrobe with weather-based daily suggestions and AI-powered try-ons. Hosted locally, powered by you.
        </motion.p>

        {/* Animated Floating Grid */}
        <div className="relative w-full max-w-6xl mt-24 h-[400px] md:h-[500px]">
          <motion.div 
            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }}
            className="absolute left-0 md:left-[10%] top-0 w-48 md:w-64 z-10"
          >
            <motion.div animate={floatAnimation(0)} className="bg-[#E8EDE9] rounded-3xl overflow-hidden shadow-xl border-4 border-white">
              <img src="https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=600&auto=format&fit=crop" alt="Item 1" className="w-full h-auto object-cover" />
            </motion.div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.6 }}
            className="absolute left-[50%] -translate-x-1/2 top-[15%] w-56 md:w-72 z-30"
          >
            <motion.div animate={floatAnimation(1, true)} className="bg-[#E8EDE9] rounded-3xl overflow-hidden shadow-2xl shadow-[#1A365D]/10 border-4 border-white">
              <img src="https://images.unsplash.com/photo-1576566588028-4147f3842f27?q=80&w=600&auto=format&fit=crop" alt="Item 2" className="w-full h-auto object-cover" />
            </motion.div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.5 }}
            className="absolute right-0 md:right-[15%] top-[5%] w-40 md:w-56 z-20"
          >
            <motion.div animate={floatAnimation(0.5)} className="bg-[#E8EDE9] rounded-3xl overflow-hidden shadow-xl border-4 border-white">
              <img src="https://images.unsplash.com/photo-1604176354204-9268737828e4?q=80&w=600&auto=format&fit=crop" alt="Item 3" className="w-full h-auto object-cover" />
            </motion.div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.7 }}
            className="absolute right-[5%] md:right-[25%] bottom-0 w-48 md:w-64 z-10"
          >
            <motion.div animate={floatAnimation(1.5, true)} className="bg-[#E8EDE9] rounded-3xl overflow-hidden shadow-xl border-4 border-white">
              <img src="https://images.unsplash.com/photo-1588117305388-c2631a279f82?q=80&w=600&auto=format&fit=crop" alt="Item 4" className="w-full h-auto object-cover" />
            </motion.div>
          </motion.div>
        </div>
      </header>

      {/* --- Supabase Authentication --- */}
      <section className="px-8 lg:px-16 py-12 flex justify-center border-t border-editorial-gray/10">
        <AuthComponent />
      </section>
      {/* --------------------------------- */}


      {/* Feature 1: Digitize */}
      <section className="relative px-8 lg:px-16 py-24 md:py-32 grid grid-cols-1 lg:grid-cols-2 gap-16 md:gap-24 items-center">
        <motion.div
          initial={{ opacity: 0, x: -50, rotate: -3 }}
          whileInView={{ opacity: 1, x: 0, rotate: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, type: "spring" }}
          className="order-2 lg:order-1 relative"
        >
          <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.4 }} className="aspect-[4/5] md:aspect-square bg-[#E8EDE9] rounded-[2.5rem] overflow-hidden shadow-2xl">
             <img src="https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?q=80&w=1000&auto=format&fit=crop" alt="Digitize interface" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
          </motion.div>
        </motion.div>

        <div className="order-1 lg:order-2 flex flex-col justify-center">
          <motion.span 
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="uppercase tracking-[0.2em] text-xs font-bold text-[#1A365D] mb-6"
          >
            01 — Digitize
          </motion.span>
          <motion.h3 
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
            className="font-serif text-4xl md:text-5xl lg:text-6xl mb-6 leading-[1.1] text-[#1C2321]"
          >
            Your closet, <br />pixel perfect.
          </motion.h3>
          <motion.p 
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
            className="text-lg text-[#1C2321]/60 font-light mb-10 max-w-md leading-relaxed"
          >
            Drop in photos of your garments. Keep the original or instantly remove the background for a clean, editorial look. Categorize by color, style, and detail.
          </motion.p>
          
          <motion.ul 
            variants={listContainer} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="space-y-5 text-sm font-medium text-[#1C2321]"
          >
            <motion.li variants={listItem} className="flex items-center gap-4">
              <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-[#E8EDE9] text-[#1A365D]">✦</span>
              Automatic background removal
            </motion.li>
            <motion.li variants={listItem} className="flex items-center gap-4">
              <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-[#E8EDE9] text-[#1A365D]">❖</span>
              Organize by color and category
            </motion.li>
            <motion.li variants={listItem} className="flex items-center gap-4">
              <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-[#E8EDE9] text-[#1A365D]">🔒</span>
              Local privacy-first storage
            </motion.li>
          </motion.ul>
        </div>
      </section>

      {/* Feature 2: Curate */}
      <section className="px-8 lg:px-16 py-24 md:py-32 grid grid-cols-1 lg:grid-cols-2 gap-16 md:gap-24 items-center bg-[#1A365D] text-[#F9F8F6] rounded-[3rem] mx-4 md:mx-8 shadow-2xl">
        <div className="order-1 lg:order-1 flex flex-col justify-center lg:pl-8">
          <motion.span 
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="uppercase tracking-[0.2em] text-xs font-bold text-[#E8EDE9]/70 mb-6"
          >
            02 — Curate
          </motion.span>
          <motion.h3 
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
            className="font-serif text-4xl md:text-5xl lg:text-6xl mb-6 leading-[1.1]"
          >
            Dress for the <br />forecast.
          </motion.h3>
          <motion.p 
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
            className="text-lg text-[#F9F8F6]/80 font-light mb-10 max-w-md leading-relaxed"
          >
            Never second-guess the weather. Wardrobe checks local Open-Meteo forecasts to suggest outfits tailored for today's temperature and rain probability. 
          </motion.p>
          
          <motion.ul 
            variants={listContainer} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="space-y-5 text-sm font-medium"
          >
            <motion.li variants={listItem} className="flex items-center gap-4">
              <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-[#1C2321]/30">⛅</span>
              Location-based climate logic
            </motion.li>
            <motion.li variants={listItem} className="flex items-center gap-4">
              <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-[#1C2321]/30">🎯</span>
              Rule-based category combinations
            </motion.li>
          </motion.ul>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="order-2 lg:order-2 relative"
        >
          <motion.div whileHover={{ y: -10 }} transition={{ duration: 0.4 }} className="aspect-[4/5] md:aspect-square bg-[#1C2321] rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-[#2C4A73]">
             <img src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=1000&auto=format&fit=crop" alt="Daily suggestions layout" className="w-full h-full object-cover opacity-90" />
          </motion.div>
        </motion.div>
      </section>

      {/* Feature 3: Visualize */}
      <section className="relative px-8 lg:px-16 py-24 md:py-32 grid grid-cols-1 lg:grid-cols-2 gap-16 md:gap-24 items-center">
        <motion.div
          initial={{ opacity: 0, x: -50, rotate: 3 }}
          whileInView={{ opacity: 1, x: 0, rotate: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, type: "spring" }}
          className="order-2 lg:order-1 relative"
        >
          <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.4 }} className="aspect-[4/5] md:aspect-square bg-[#E8EDE9] rounded-[2.5rem] overflow-hidden shadow-2xl">
             <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=1000&auto=format&fit=crop" alt="AI Try-on interface" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
          </motion.div>
        </motion.div>

        <div className="order-1 lg:order-2 flex flex-col justify-center">
          <motion.span 
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="uppercase tracking-[0.2em] text-xs font-bold text-[#1A365D] mb-6"
          >
            03 — Visualize
          </motion.span>
          <motion.h3 
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
            className="font-serif text-4xl md:text-5xl lg:text-6xl mb-6 leading-[1.1] text-[#1C2321]"
          >
            See it before <br />you wear it.
          </motion.h3>
          <motion.p 
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
            className="text-lg text-[#1C2321]/60 font-light mb-10 max-w-md leading-relaxed"
          >
            Provide a reference photo and let the integrated OpenAI vision model drape suggested garments onto your silhouette. It's a digital fitting room, generating conceptual previews in seconds.
          </motion.p>
          
          <motion.ul 
            variants={listContainer} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="space-y-5 text-sm font-medium text-[#1C2321]"
          >
            <motion.li variants={listItem} className="flex items-center gap-4">
              <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-[#E8EDE9] text-[#1A365D]">✨</span>
              Powered by OpenAI models
            </motion.li>
            <motion.li variants={listItem} className="flex items-center gap-4">
              <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-[#E8EDE9] text-[#1A365D]">⚡</span>
              Conceptual generative previews
            </motion.li>
          </motion.ul>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 lg:px-16 py-12 border-t border-[#1A365D]/10 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-3">
          <img 
            src="/logo.png" 
            alt="thefit Logo" 
            className="h-10 w-auto object-contain" 
          />
          <span className="font-sans text-2xl font-black tracking-tighter text-[#1A365D]">
            thefit
          </span>
        </div>
        
        <p className="text-xs text-[#1C2321]/50 font-bold uppercase tracking-widest">
          MIT Licensed <span className="mx-2 font-normal text-[#1A365D]">/</span> Local First
        </p>
        
        <div className="flex gap-4">
          <motion.a 
            whileHover={{ y: -2 }}
            href="https://github.com/tandpfun/wardrobe" 
            className="text-sm font-medium text-[#1C2321]/60 hover:text-[#1A365D] transition-colors"
          >
            GitHub
          </motion.a>
        </div>
      </footer>

    </div>
  );
}

// --- PASTE THIS ENTIRE COMPONENT AT THE VERY BOTTOM ---
export function AuthComponent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [status, setStatus] = useState('')

  const handleSignUp = async () => {
    setStatus('Creating account...')
    const { error } = await signUpUser(email, password, username)
    setStatus(error ? error.message : 'Account created! Please log in.')
  }

  const handleLogin = async () => {
    setStatus('Logging in...')
    const { error } = await signInUser(email, password)
    setStatus(error ? error.message : 'Logged in successfully!')
  }

  return (
    <div className="w-full max-w-md bg-gray-50 p-8 rounded-xl shadow-lg border border-editorial-gray/10">
      <h3 className="font-serif text-2xl font-semibold mb-6 text-center">Access Wardrobe</h3>
      
      <div className="flex flex-col gap-4">
        <input 
          type="text" 
          placeholder="Username (Required for Sign Up)" 
          value={username} 
          onChange={(e) => setUsername(e.target.value)}
          className="px-4 py-3 rounded-lg border border-editorial-gray/20 focus:outline-none focus:border-editorial-black"
        />
        <input 
          type="email" 
          placeholder="Email address" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)}
          className="px-4 py-3 rounded-lg border border-editorial-gray/20 focus:outline-none focus:border-editorial-black"
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)}
          className="px-4 py-3 rounded-lg border border-editorial-gray/20 focus:outline-none focus:border-editorial-black"
        />
        
        <div className="flex gap-4 mt-2">
          <button 
            onClick={handleSignUp}
            className="flex-1 bg-white text-editorial-black border border-editorial-black px-4 py-2.5 rounded-full text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Sign Up
          </button>
          <button 
            onClick={handleLogin}
            className="flex-1 bg-editorial-black text-white px-4 py-2.5 rounded-full text-sm font-medium hover:bg-black/80 transition-colors shadow-lg"
          >
            Log In
          </button>
        </div>
      </div>
      
      {status && (
        <p className="mt-6 text-sm text-center font-medium text-editorial-gray">
          {status}
        </p>
      )}
    </div>
  )
}