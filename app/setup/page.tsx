"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { UserPlus, Loader2, Server, ArrowRight, Eye, EyeOff } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  
  // Track visual steps (welcome vs form)
  const [step, setStep] = useState<"welcome" | "form">("welcome");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create admin account");
      }

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-bg-secondary to-bg-primary">
      <div className="w-full max-w-md bg-bg-surface border border-border-primary rounded-2xl shadow-2xl overflow-hidden relative">
        
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-primary to-blue-500" />
        
        {step === "welcome" && (
          <div className="p-10 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-center mb-8 mt-2">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-blue-500 rounded-full blur opacity-30 group-hover:opacity-60 transition duration-1000"></div>
                <div className="relative bg-bg-panel border border-border-primary rounded-full p-2 flex flex-col items-center justify-center shadow-lg">
                  <Image src="/logo.svg" alt="OmniRad Logo" width={180} height={180} priority className="object-contain" />
                </div>
              </div>
            </div>
            
            <h1 className="text-3xl font-bold text-text-heading mb-4 tracking-tight">
              Welcome to OmniRad
            </h1>
            
            <p className="text-text-secondary leading-relaxed mb-10">
              Your intelligent AI-powered radiology workspace. Fast, secure, and designed to seamlessly enhance your diagnostic workflows. Let's get your environment set up.
            </p>

            <button
              onClick={() => setStep("form")}
              className="w-full group flex items-center justify-center space-x-2 bg-primary hover:bg-primary-hover text-white font-medium py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-primary/25 active:scale-[0.98]"
            >
              <span>Start Now</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {step === "form" && (
          <div className="p-8 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-text-heading mb-2">
                Create Admin Account
              </h1>
              <p className="text-text-secondary text-sm">
                Set up the initial Master Administrator account to secure your installation.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5 ml-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-bg-panel border border-border-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-text-primary transition-all shadow-sm"
                  placeholder="Dr. John Doe"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5 ml-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                  className="w-full px-4 py-2.5 bg-bg-panel border border-border-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-text-primary transition-all shadow-sm"
                  placeholder="johndoe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5 ml-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-bg-panel border border-border-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-text-primary transition-all shadow-sm"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5 ml-1">
                  Secure Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2.5 bg-bg-panel border border-border-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-text-primary transition-all shadow-sm pr-12"
                    placeholder="Minimum 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary focus:outline-none transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-sm animate-in zoom-in-95 duration-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center space-x-2 bg-primary hover:bg-primary-hover text-white font-medium py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-primary/25 mt-8 disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    <span>Create System Admin</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
