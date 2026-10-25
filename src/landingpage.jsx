import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function LandingPage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.2, delayChildren: 0.6 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };

  return (
    <div className="min-h-screen bg-editorial-white text-editorial-black font-sans selection:bg-editorial-black selection:text-editorial-white overflow-x-hidden">
      
      {/* Navigation */}
      <nav className="relative z-10 flex justify-between items-center p-8 lg:px-16 border-b border-editorial-gray/10">
        <h1 className="font-serif text-2xl font-semibold tracking-wide">Wardrobe.</h1>
        <div className="flex gap-6 items-center">
          <a href="https://github.com/tandpfun/wardrobe" target="_blank" rel="noreferrer" className="text-sm font-medium hover:text-editorial-gray transition-colors">
            GitHub
          </a>
          <Link to="/app" className="bg-editorial-black text-editorial-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-black/80 transition-colors shadow-lg">
            Open Closet
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative px-8 lg:px-16 pt-20 pb-24 flex flex-col items-center text-center">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 font-serif text-6xl md:text-7xl lg:text-8xl max-w-5xl leading-[1.1]"
        >
          Your clothes, <br />
          <span className="italic text-editorial-gray font-light">beautifully</span> organized.
        </motion.h2>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="relative z-10 mt-8 text-lg md:text-xl text-editorial-gray max-w-2xl font-light"
        >
          A smart digital wardrobe with weather-based daily suggestions and AI-powered try-ons. Hosted locally, powered by you.
        </motion.p>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="relative w-full max-w-6xl mt-24 h-[400px] md:h-[500px]"
        >
          <motion.div variants={itemVariants} className="absolute left-0 md:left-[10%] top-0 w-48 md:w-64 drop-shadow-2xl bg-gray-100 rounded-lg overflow-hidden">
            <img src="https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=600&auto=format&fit=crop" alt="Placeholder 1" className="w-full h-auto object-cover hover:scale-105 transition-transform duration-500" />
          </motion.div>

          <motion.div variants={itemVariants} className="absolute left-[50%] -translate-x-1/2 top-[20%] w-56 md:w-72 drop-shadow-2xl z-20 bg-gray-100 rounded-lg overflow-hidden">
            <img src="https://images.unsplash.com/photo-1576566588028-4147f3842f27?q=80&w=600&auto=format&fit=crop" alt="Placeholder 2" className="w-full h-auto object-cover hover:scale-105 transition-transform duration-500" />
          </motion.div>

          <motion.div variants={itemVariants} className="absolute right-0 md:right-[15%] top-[5%] w-40 md:w-56 drop-shadow-2xl bg-gray-100 rounded-lg overflow-hidden">
            <img src="https://images.unsplash.com/photo-1604176354204-9268737828e4?q=80&w=600&auto=format&fit=crop" alt="Placeholder 3" className="w-full h-auto object-cover hover:scale-105 transition-transform duration-500" />
          </motion.div>

          <motion.div variants={itemVariants} className="absolute right-[5%] md:right-[25%] bottom-0 w-48 md:w-64 drop-shadow-2xl bg-gray-100 rounded-lg overflow-hidden">
            <img src="https://images.unsplash.com/photo-1588117305388-c2631a279f82?q=80&w=600&auto=format&fit=crop" alt="Placeholder 4" className="w-full h-auto object-cover hover:scale-105 transition-transform duration-500" />
          </motion.div>
        </motion.div>
      </header>

      {/* Feature 1: Digitize */}
      <section className="px-8 lg:px-16 py-24 md:py-32 grid grid-cols-1 lg:grid-cols-2 gap-16 md:gap-24 items-center">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="order-2 lg:order-1 relative"
        >
          <div className="aspect-[4/5] md:aspect-square bg-gray-200 rounded-xl overflow-hidden shadow-2xl">
             <img src="https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?q=80&w=1000&auto=format&fit=crop" alt="Digitize interface" className="w-full h-full object-cover" />
          </div>
          <div className="absolute -bottom-8 -right-8 w-64 h-64 bg-editorial-gray/10 rounded-full blur-3xl -z-10"></div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          className="order-1 lg:order-2 flex flex-col justify-center"
        >
          <span className="uppercase tracking-[0.2em] text-xs font-semibold text-editorial-gray mb-6">01. Digitize</span>
          <h3 className="font-serif text-4xl md:text-5xl lg:text-6xl mb-6 leading-[1.1]">
            Your closet, <br />pixel perfect.
          </h3>
          <p className="text-lg text-editorial-gray font-light mb-10 max-w-md leading-relaxed">
            Drop in photos of your garments. Keep the original or instantly remove the background for a clean, editorial look. Categorize by color, style, and detail to build your ultimate digital archive.
          </p>
          <ul className="space-y-5 text-sm font-medium">
            <li className="flex items-center gap-4">
              <span className="w-1.5 h-1.5 rounded-full bg-editorial-black"></span>
              Automatic background removal
            </li>
            <li className="flex items-center gap-4">
              <span className="w-1.5 h-1.5 rounded-full bg-editorial-black"></span>
              Organize by color and category
            </li>
            <li className="flex items-center gap-4">
              <span className="w-1.5 h-1.5 rounded-full bg-editorial-black"></span>
              Local privacy-first storage
            </li>
          </ul>
        </motion.div>
      </section>

      {/* Feature 2: Daily Suggestions */}
      <section className="px-8 lg:px-16 py-24 md:py-32 grid grid-cols-1 lg:grid-cols-2 gap-16 md:gap-24 items-center bg-editorial-black text-editorial-white">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          className="order-1 lg:order-1 flex flex-col justify-center"
        >
          <span className="uppercase tracking-[0.2em] text-xs font-semibold text-editorial-gray mb-6">02. Curate</span>
          <h3 className="font-serif text-4xl md:text-5xl lg:text-6xl mb-6 leading-[1.1]">
            Dress for the <br />forecast.
          </h3>
          <p className="text-lg text-editorial-gray font-light mb-10 max-w-md leading-relaxed">
            Never second-guess the weather. Wardrobe checks local Open-Meteo forecasts to suggest outfits tailored for today's temperature and rain probability. 
          </p>
          <ul className="space-y-5 text-sm font-medium">
            <li className="flex items-center gap-4">
              <span className="w-1.5 h-1.5 rounded-full bg-editorial-white"></span>
              Location-based climate logic
            </li>
            <li className="flex items-center gap-4">
              <span className="w-1.5 h-1.5 rounded-full bg-editorial-white"></span>
              Rule-based category combinations
            </li>
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="order-2 lg:order-2 relative"
        >
          <div className="aspect-[4/5] md:aspect-square bg-gray-800 rounded-xl overflow-hidden shadow-2xl">
             <img src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=1000&auto=format&fit=crop" alt="Daily suggestions layout" className="w-full h-full object-cover opacity-90" />
          </div>
          <div className="absolute -bottom-8 -left-8 w-64 h-64 bg-editorial-gray/10 rounded-full blur-3xl -z-10"></div>
        </motion.div>
      </section>

      {/* Feature 3: AI Try-On */}
      <section className="px-8 lg:px-16 py-24 md:py-32 grid grid-cols-1 lg:grid-cols-2 gap-16 md:gap-24 items-center">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="order-2 lg:order-1 relative"
        >
          <div className="aspect-[4/5] md:aspect-square bg-gray-200 rounded-xl overflow-hidden shadow-2xl">
             <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=1000&auto=format&fit=crop" alt="AI Try-on interface" className="w-full h-full object-cover" />
          </div>
          <div className="absolute -bottom-8 -right-8 w-64 h-64 bg-editorial-gray/10 rounded-full blur-3xl -z-10"></div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          className="order-1 lg:order-2 flex flex-col justify-center"
        >
          <span className="uppercase tracking-[0.2em] text-xs font-semibold text-editorial-gray mb-6">03. Visualize</span>
          <h3 className="font-serif text-4xl md:text-5xl lg:text-6xl mb-6 leading-[1.1]">
            See it before <br />you wear it.
          </h3>
          <p className="text-lg text-editorial-gray font-light mb-10 max-w-md leading-relaxed">
            Provide a reference photo and let the integrated OpenAI vision model drape suggested garments onto your silhouette. It's a digital fitting room, generating conceptual previews in seconds.
          </p>
          <ul className="space-y-5 text-sm font-medium">
            <li className="flex items-center gap-4">
              <span className="w-1.5 h-1.5 rounded-full bg-editorial-black"></span>
              Powered by OpenAI image-edit API
            </li>
            <li className="flex items-center gap-4">
              <span className="w-1.5 h-1.5 rounded-full bg-editorial-black"></span>
              Secure local configuration
            </li>
          </ul>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="px-8 lg:px-16 py-12 border-t border-editorial-gray/10 flex flex-col md:flex-row justify-between items-center gap-6">
        <h2 className="font-serif text-xl font-semibold">Wardrobe.</h2>
        <p className="text-xs text-editorial-gray font-medium uppercase tracking-widest">
          MIT Licensed. Local First.
        </p>
        <div className="flex gap-4">
          <a href="https://github.com/tandpfun/wardrobe" className="text-sm hover:text-editorial-gray transition-colors">GitHub</a>
        </div>
      </footer>

    </div>
  );
}