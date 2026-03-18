"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { UploadCloud, X, Download, Scissors, Sparkles } from "lucide-react";
import { motion, AnimatePresence, Variants } from "framer-motion";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2
    }
  }
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 100, damping: 15 }
  }
};

export default function Atelier() {
  const [cutFile, setCutFile] = useState<File | null>(null);
  const [cutPreview, setCutPreview] = useState<string | null>(null);
  const [isDraggingCut, setIsDraggingCut] = useState(false);
  
  const [clothFile, setClothFile] = useState<File | null>(null);
  const [clothPreview, setClothPreview] = useState<string | null>(null);
  const [isDraggingCloth, setIsDraggingCloth] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cutInputRef = useRef<HTMLInputElement>(null);
  const clothInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File, type: "cut" | "cloth") => {
    if (!file.type.startsWith("image/")) return;
    
    const previewUrl = URL.createObjectURL(file);
    if (type === "cut") {
      setCutFile(file);
      setCutPreview(previewUrl);
    } else {
      setClothFile(file);
      setClothPreview(previewUrl);
    }
    setResultImage(null);
    setError(null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, type: "cut" | "cloth") => {
    e.preventDefault();
    if (type === "cut") setIsDraggingCut(false);
    if (type === "cloth") setIsDraggingCloth(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file, type);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, type: "cut" | "cloth") => {
    e.preventDefault();
    if (type === "cut") setIsDraggingCut(true);
    if (type === "cloth") setIsDraggingCloth(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>, type: "cut" | "cloth") => {
    e.preventDefault();
    if (type === "cut") setIsDraggingCut(false);
    if (type === "cloth") setIsDraggingCloth(false);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>, type: "cut" | "cloth") => {
    const file = e.target.files?.[0];
    if (file) handleFile(file, type);
  };

  const removeImage = (type: "cut" | "cloth") => {
    if (type === "cut") {
      setCutFile(null);
      setCutPreview(null);
      if (cutInputRef.current) cutInputRef.current.value = "";
    } else {
      setClothFile(null);
      setClothPreview(null);
      if (clothInputRef.current) clothInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!cutFile || !clothFile) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append("cut", cutFile);
      formData.append("cloth", clothFile);

      const response = await fetch("/api/tailor", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to tailor garment");
      }

      setResultImage(`data:${data.mimeType};base64,${data.image}`);
      
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 300);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const a = document.createElement("a");
    a.href = resultImage;
    a.download = "atelier-tailored-garment.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="relative min-h-screen bg-zinc-950 overflow-hidden font-sans text-zinc-50">
      {/* Subtle background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-500 via-zinc-950 to-zinc-950 pointer-events-none rounded-full blur-[100px]" />
      
      <motion.main 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 p-8 md:p-16 lg:p-24 max-w-7xl mx-auto w-full flex flex-col items-center"
      >
        <motion.header variants={itemVariants} className="mb-16 text-center w-full">
          <h1 className="text-5xl md:text-7xl font-serif tracking-widest uppercase mb-4 text-zinc-100 font-light flex items-center justify-center gap-4">
            <Sparkles className="w-8 h-8 md:w-12 md:h-12 text-zinc-500 opacity-50" />
            Atelier
            <Sparkles className="w-8 h-8 md:w-12 md:h-12 text-zinc-500 opacity-50" />
          </h1>
          <p className="text-zinc-400 text-sm md:text-base tracking-widest uppercase mb-8">
            Reimagine the cloth. Preserve the cut.
          </p>
          <div className="h-[1px] w-48 bg-zinc-800 mx-auto"></div>
        </motion.header>

        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* The Cut Dropzone */}
          <motion.div variants={itemVariants} className="flex flex-col gap-4">
            <h2 className="font-serif text-2xl text-zinc-300 flex items-center gap-2">
              <span className="text-zinc-500 italic text-lg">01.</span> The Cut
            </h2>
            <div 
              className={`relative overflow-hidden border ${isDraggingCut ? 'border-zinc-400 bg-zinc-900/80 scale-[1.02]' : 'border-zinc-800 bg-zinc-950'} border-dashed rounded-lg h-96 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer ${cutPreview ? 'border-solid' : 'hover:bg-zinc-900/50 hover:border-zinc-600'} group`}
              onDragOver={(e) => handleDragOver(e, "cut")}
              onDragLeave={(e) => handleDragLeave(e, "cut")}
              onDrop={(e) => handleDrop(e, "cut")}
              onClick={() => !cutPreview && cutInputRef.current?.click()}
            >
              <AnimatePresence mode="wait">
                {cutPreview ? (
                  <motion.div 
                    key="cut-preview"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full h-full relative"
                  >
                    <img src={cutPreview} alt="The Cut Preview" className="w-full h-full object-cover opacity-80" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeImage("cut"); }}
                      className="absolute top-4 right-4 p-2 bg-zinc-950/80 rounded-full text-zinc-400 hover:text-white transition-colors backdrop-blur-sm z-10"
                    >
                      <X size={20} />
                    </button>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="cut-empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center text-zinc-500 gap-4 pointer-events-none"
                  >
                    <Scissors size={48} strokeWidth={1} className={`transition-all duration-500 ${isDraggingCut ? 'scale-110 text-zinc-300 transform -rotate-12' : 'opacity-50'}`} />
                    <div className="text-center font-serif text-lg">
                      <p className={`transition-colors ${isDraggingCut ? 'text-zinc-100' : 'text-zinc-300'}`}>Upload silhouette</p>
                      <p className="text-sm text-zinc-600 mt-2 font-sans tracking-wide">Drag & drop or click to browse</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <input 
                type="file" 
                ref={cutInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => handleChange(e, "cut")} 
              />
            </div>
          </motion.div>

          {/* The Cloth Dropzone */}
          <motion.div variants={itemVariants} className="flex flex-col gap-4">
            <h2 className="font-serif text-2xl text-zinc-300 flex items-center gap-2">
              <span className="text-zinc-500 italic text-lg">02.</span> The Cloth
            </h2>
            <div 
              className={`relative overflow-hidden border ${isDraggingCloth ? 'border-zinc-400 bg-zinc-900/80 scale-[1.02]' : 'border-zinc-800 bg-zinc-950'} border-dashed rounded-lg h-96 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer ${clothPreview ? 'border-solid' : 'hover:bg-zinc-900/50 hover:border-zinc-600'} group`}
              onDragOver={(e) => handleDragOver(e, "cloth")}
              onDragLeave={(e) => handleDragLeave(e, "cloth")}
              onDrop={(e) => handleDrop(e, "cloth")}
              onClick={() => !clothPreview && clothInputRef.current?.click()}
            >
              <AnimatePresence mode="wait">
                {clothPreview ? (
                  <motion.div 
                    key="cloth-preview"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full h-full relative"
                  >
                    <img src={clothPreview} alt="The Cloth Preview" className="w-full h-full object-cover opacity-80" />
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeImage("cloth"); }}
                      className="absolute top-4 right-4 p-2 bg-zinc-950/80 rounded-full text-zinc-400 hover:text-white transition-colors backdrop-blur-sm z-10"
                    >
                      <X size={20} />
                    </button>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="cloth-empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center text-zinc-500 gap-4 pointer-events-none"
                  >
                    <UploadCloud size={48} strokeWidth={1} className={`transition-all duration-500 ${isDraggingCloth ? 'scale-110 text-zinc-300 transform -translate-y-2' : 'opacity-50'}`} />
                    <div className="text-center font-serif text-lg">
                      <p className={`transition-colors ${isDraggingCloth ? 'text-zinc-100' : 'text-zinc-300'}`}>Upload fabric texture</p>
                      <p className="text-sm text-zinc-600 mt-2 font-sans tracking-wide">Drag & drop or click to browse</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <input 
                type="file" 
                ref={clothInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => handleChange(e, "cloth")} 
              />
            </div>
          </motion.div>
        </div>

        <motion.div variants={itemVariants} className="w-full flex flex-col items-center mb-16">
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 px-4 py-3 bg-red-950/50 border border-red-900 text-red-200 rounded-md text-sm text-center max-w-md backdrop-blur-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>
          
          <motion.button
            whileHover={!(!cutFile || !clothFile || loading) ? { scale: 1.05, boxShadow: "0px 0px 20px rgba(255,255,255,0.15)" } : {}}
            whileTap={!(!cutFile || !clothFile || loading) ? { scale: 0.98 } : {}}
            onClick={handleSubmit}
            disabled={!cutFile || !clothFile || loading}
            className={`
              px-12 py-4 rounded-full font-serif text-xl tracking-wider uppercase transition-colors duration-300
              ${!cutFile || !clothFile 
                ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed border border-zinc-800' 
                : loading 
                  ? 'bg-zinc-800 text-zinc-300 cursor-wait border border-zinc-700 shadow-[0_0_15px_rgba(255,255,255,0.05)]' 
                  : 'bg-zinc-100 text-zinc-950 border border-transparent'
              }
            `}
          >
            {loading ? (
              <span className="flex items-center gap-3">
                <motion.span 
                  animate={{ opacity: [0.5, 1, 0.5] }} 
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  className="w-2 h-2 rounded-full bg-zinc-400"
                />
                Crafting Garment...
                <motion.span 
                  animate={{ opacity: [0.5, 1, 0.5] }} 
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                  className="w-2 h-2 rounded-full bg-zinc-400"
                />
              </span>
            ) : (
              "Tailor Garment"
            )}
          </motion.button>
        </motion.div>

        <AnimatePresence>
          {resultImage && (
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 80, damping: 20 }}
              className="w-full justify-center flex flex-col items-center"
            >
              <div className="w-full h-[1px] bg-gradient-to-r from-zinc-950 via-zinc-800 to-zinc-950 mb-16"></div>
              <h2 className="font-serif text-3xl text-zinc-200 mb-8 italic flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-zinc-500" />
                The Result
                <Sparkles className="w-6 h-6 text-zinc-500" />
              </h2>
              <div className="relative w-full max-w-3xl overflow-hidden border border-zinc-800 bg-zinc-900 shadow-2xl mb-8 group rounded-xl p-4 text-center">
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.8 }}
                  className="absolute inset-0 bg-gradient-to-t from-zinc-950/50 to-transparent z-10 pointer-events-none"
                />
                <img src={resultImage} alt="Tailored Garment" className="relative z-0 w-auto max-w-full max-h-[700px] object-contain mx-auto rounded-lg group-hover:scale-[1.02] transition-transform duration-700 ease-out" />
              </div>
              <motion.button 
                whileHover={{ scale: 1.05, backgroundColor: "#18181b", color: "#fff" }}
                whileTap={{ scale: 0.95 }}
                onClick={handleDownload}
                className="flex items-center gap-3 px-8 py-3 border border-zinc-700 text-zinc-300 rounded-full transition-colors text-sm tracking-widest uppercase shadow-lg shadow-zinc-950/50 bg-zinc-900/50 backdrop-blur-md"
              >
                <Download size={16} />
                Download to Collection
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.main>
    </div>
  );
}
