import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { differenceInDays, parseISO, format, addDays, startOfDay } from 'date-fns';
import { 
  Apple, Milk, Beef, Wheat, Package, 
  Plus, Trash2, X, Sparkles, ChefHat, AlertTriangle, Info, Camera, Loader2,
  Bookmark, ChevronDown, ChevronUp
} from 'lucide-react';
import { FoodItem, RecipeSuggestion, SavedRecipe } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage, Language, translations } from './LanguageContext';

const CATEGORIES = [
  { name: 'Produce', icon: Apple, color: 'text-green-500', bg: 'bg-green-100' },
  { name: 'Dairy', icon: Milk, color: 'text-blue-500', bg: 'bg-blue-100' },
  { name: 'Meat', icon: Beef, color: 'text-red-500', bg: 'bg-red-100' },
  { name: 'Pantry', icon: Wheat, color: 'text-amber-500', bg: 'bg-amber-100' },
  { name: 'Other', icon: Package, color: 'text-slate-500', bg: 'bg-slate-100' },
];

const getCategoryTranslationKey = (name: string): keyof typeof translations.en => {
  switch (name) {
    case 'Produce': return 'catProduce';
    case 'Dairy': return 'catDairy';
    case 'Meat': return 'catMeat';
    case 'Pantry': return 'catPantry';
    default: return 'catOther';
  }
};

export default function App() {
  const { language, setLanguage, t, dateLocale } = useLanguage();

  // Authentication State
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('fridge-token'));
  const [user, setUser] = useState<any | null>(() => {
    try {
      const saved = localStorage.getItem('fridge-user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // App Data State
  const [items, setItems] = useState<FoodItem[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(false);

  const [isAdding, setIsAdding] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState(CATEGORIES[0].name);
  const [newItemExpiryDays, setNewItemExpiryDays] = useState('7');

  const [recipes, setRecipes] = useState<RecipeSuggestion[] | null>(null);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(false);
  const [recipeError, setRecipeError] = useState('');
  
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);

  // Authenticated fetch helper
  const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const activeToken = token || localStorage.getItem('fridge-token');
    const headers = {
      'Content-Type': 'application/json',
      ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {}),
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401) {
      handleSignOut();
      throw new Error('Session expired. Please sign in again.');
    }
    
    return response;
  };

  // Sync state from Database
  useEffect(() => {
    if (!user || !token) return;

    const loadData = async () => {
      setIsInitialLoading(true);
      try {
        const invRes = await fetchWithAuth('/api/fridge');
        const invData = await invRes.json();
        setItems(invData);

        const recRes = await fetchWithAuth('/api/recipes/saved');
        const recData = await recRes.json();
        setSavedRecipes(recData);
      } catch (err) {
        console.error('Error loading initial data:', err);
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadData();
  }, [user, token]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword) return;

    setIsAuthLoading(true);
    setAuthError('');

    const endpoint = isSignUp ? '/api/auth/signup' : '/api/auth/signin';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail.toLowerCase().trim(), password: authPassword }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to authenticate');
      }

      localStorage.setItem('fridge-token', data.token);
      localStorage.setItem('fridge-user', JSON.stringify(data.user));

      setToken(data.token);
      setUser(data.user);
      
      setAuthEmail('');
      setAuthPassword('');
    } catch (err: any) {
      console.error('Auth error:', err);
      setAuthError(err.message || 'An error occurred during authentication.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('fridge-token');
    localStorage.removeItem('fridge-user');
    setToken(null);
    setUser(null);
    setItems([]);
    setSavedRecipes([]);
    setRecipes(null);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const expiryDate = addDays(startOfDay(new Date()), parseInt(newItemExpiryDays) || 0).toISOString();
    
    try {
      const response = await fetchWithAuth('/api/fridge', {
        method: 'POST',
        body: JSON.stringify({
          name: newItemName.trim(),
          category: newItemCategory,
          addedDate: new Date().toISOString(),
          expiryDate,
        }),
      });

      const data = await response.json();
      setItems([...items, data]);
      setIsAdding(false);
      setNewItemName('');
      setNewItemExpiryDays('7');
    } catch (err: any) {
      console.error('Error adding item:', err);
      alert(err.message || 'Failed to add item.');
    }
  };

  const handleScanClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setIsScanning(true);
    
    try {
      // Read file as base64
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await fetchWithAuth('/api/scan-groceries', {
        method: 'POST',
        body: JSON.stringify({ imageBase64: base64Data }),
      });

      const data = await response.json();
      
      if (data.items && Array.isArray(data.items)) {
        const savedItems = await Promise.all(
          data.items.map(async (item: any) => {
            const addedDate = new Date().toISOString();
            const expiryDate = addDays(startOfDay(new Date()), item.expiryDays || 7).toISOString();
            const res = await fetchWithAuth('/api/fridge', {
              method: 'POST',
              body: JSON.stringify({
                name: item.name,
                category: CATEGORIES.some(c => c.name === item.category) ? item.category : 'Other',
                addedDate,
                expiryDate,
              }),
            });
            return res.json();
          })
        );
        
        setItems(prev => [...prev, ...savedItems]);
      }
    } catch (error: any) {
      console.error('Error scanning groceries:', error);
      alert(t('errScanFailed'));
    } finally {
      setIsScanning(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await fetchWithAuth(`/api/fridge/${id}`, {
        method: 'DELETE',
      });
      setItems(items.filter(item => item.id !== id));
    } catch (err: any) {
      console.error('Error deleting item:', err);
      alert(err.message || 'Failed to delete item.');
    }
  };

  const handleSaveRecipe = async (recipe: RecipeSuggestion) => {
    if (savedRecipes.some(r => r.title.toLowerCase() === recipe.title.toLowerCase())) {
      return;
    }
    
    try {
      const response = await fetchWithAuth('/api/recipes/saved', {
        method: 'POST',
        body: JSON.stringify(recipe),
      });

      const data = await response.json();
      setSavedRecipes([...savedRecipes, data]);
    } catch (err: any) {
      console.error('Error saving recipe:', err);
      alert(err.message || 'Failed to save recipe.');
    }
  };

  const handleDeleteSavedRecipe = async (id: string) => {
    try {
      await fetchWithAuth(`/api/recipes/saved/${id}`, {
        method: 'DELETE',
      });
      setSavedRecipes(savedRecipes.filter(r => r.id !== id));
      if (expandedRecipeId === id) {
        setExpandedRecipeId(null);
      }
    } catch (err: any) {
      console.error('Error deleting saved recipe:', err);
      alert(err.message || 'Failed to delete saved recipe.');
    }
  };

  const generateRecipes = async () => {
    if (items.length === 0) return;
    
    setIsLoadingRecipes(true);
    setRecipeError('');
    setRecipes(null);

    const mappedItems = items.map(item => ({
      name: item.name,
      daysUntilExpiry: differenceInDays(parseISO(item.expiryDate), startOfDay(new Date())),
    }));

    try {
      const response = await fetchWithAuth('/api/recipes', {
        method: 'POST',
        body: JSON.stringify({ items: mappedItems, lang: language }),
      });

      const data = await response.json();
      setRecipes(data.recipes);
    } catch (err: any) {
      setRecipeError(err.message || t('errRecipesFailed'));
    } finally {
      setIsLoadingRecipes(false);
    }
  };

  // Sort items by expiry date (soonest first)
  const sortedItems = [...items].sort((a, b) => {
    return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
  });

  const getStatusColor = (expiryDate: string) => {
    const days = differenceInDays(parseISO(expiryDate), startOfDay(new Date()));
    if (days < 0) return 'text-red-600 bg-red-100 border-red-200';
    if (days <= 2) return 'text-orange-600 bg-orange-100 border-orange-200';
    if (days <= 5) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  // If loading user data from backend
  if (isInitialLoading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-slate-50 space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
        <p className="text-slate-500 font-medium">{t('authLoading')}</p>
      </div>
    );
  }

  // If not logged in, render Signup / Signin
  if (!user || !token) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-gradient-to-br from-emerald-50 via-slate-50 to-indigo-50 relative overflow-hidden">
        <div className="absolute top-10 left-10 w-72 h-72 bg-emerald-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl" />
        
        <div className="absolute top-4 right-4 z-10">
          <div className="relative inline-block text-left">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="appearance-none px-3 py-2 font-medium text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all pr-8 cursor-pointer text-sm"
              title="Select Language"
            >
              <option value="en">🇬🇧 English</option>
              <option value="fr">🇫🇷 Français</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white/80 backdrop-blur-md border border-slate-200/50 shadow-xl rounded-3xl p-8 max-w-md w-full z-10 space-y-6"
        >
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center justify-center gap-2">
              <span className="text-emerald-500 flex items-center gap-1">
                <Apple className="w-8 h-8" /> {t('brandFresh')}
              </span>{' '}
              {t('brandFridge')}
            </h1>
            <p className="text-slate-500 text-sm">{t('subtitle')}</p>
          </div>

          <div className="border-b border-slate-100 flex pb-1">
            <button
              onClick={() => { setIsSignUp(false); setAuthError(''); }}
              className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-all ${
                !isSignUp ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {t('authBtnSignIn')}
            </button>
            <button
              onClick={() => { setIsSignUp(true); setAuthError(''); }}
              className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-all ${
                isSignUp ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {t('authBtnSignUp')}
            </button>
          </div>

          {authError && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                {t('authEmail')}
              </label>
              <input
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                {t('authPassword')}
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={isAuthLoading}
              className="w-full py-2.5 px-4 font-semibold text-white bg-emerald-600 rounded-lg shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors mt-2"
            >
              {isAuthLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isAuthLoading ? t('authLoading') : isSignUp ? t('authBtnSignUp') : t('authBtnSignIn')}
            </button>
          </form>

          <div className="text-center">
            <button
              onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); }}
              className="text-xs text-slate-500 hover:text-emerald-600 hover:underline transition-colors"
            >
              {isSignUp ? t('authSwitchToSignIn') : t('authSwitchToSignUp')}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Render Logged-in Dashboard
  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span className="text-emerald-500">{t('brandFresh')}</span> {t('brandFridge')}
          </h1>
          <p className="text-slate-500 mt-1">{t('subtitle')}</p>
        </div>
        
        <div className="flex flex-wrap gap-2 md:gap-3 items-center">
          <div className="relative inline-block text-left">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="appearance-none px-3 py-2 font-medium text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all pr-8 cursor-pointer text-sm"
              title="Select Language"
            >
              <option value="en">🇬🇧 English</option>
              <option value="fr">🇫🇷 Français</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>

          <input 
            type="file" 
            accept="image/*" 
            capture="environment"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
          />
          
          <button 
            onClick={handleScanClick}
            disabled={isScanning}
            className="px-4 py-2 font-medium text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors text-sm"
          >
            {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            {isScanning ? t('btnScanning') : t('btnScan')}
          </button>

          <button 
            onClick={generateRecipes}
            disabled={items.length === 0 || isLoadingRecipes}
            className="px-4 py-2 font-medium text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors text-sm"
          >
            {isLoadingRecipes ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                <Sparkles className="w-4 h-4" />
              </motion.div>
            ) : (
              <ChefHat className="w-4 h-4" />
            )}
            {t('btnAiRecipes')}
          </button>
          
          <button 
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 font-medium text-emerald-700 bg-emerald-100 rounded-lg hover:bg-emerald-200 flex items-center gap-2 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" /> {t('btnAddFood')}
          </button>

          <button 
            onClick={handleSignOut}
            className="px-4 py-2 font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg flex items-center gap-2 transition-all text-sm shadow-sm"
            title={t('btnSignOut')}
          >
            {t('btnSignOut')}
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left Column: Inventory List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border rounded-2xl shadow-sm p-6 overflow-hidden">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Package className="w-5 h-5 text-slate-400" /> {t('titleInventory')}
            </h2>
            
            {sortedItems.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Package className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <p>{t('emptyFridge')}</p>
                <button onClick={() => setIsAdding(true)} className="text-emerald-600 font-medium hover:underline mt-2">
                  {t('addSomeItems')}
                </button>
              </div>
            ) : (
              <div className="grid gap-3">
                <AnimatePresence>
                  {sortedItems.map(item => {
                    const mappedCat = CATEGORIES.find(c => c.name === item.category) || CATEGORIES[4];
                    const Icon = mappedCat.icon;
                    const days = differenceInDays(parseISO(item.expiryDate), startOfDay(new Date()));
                    const urgency = days < 0 
                      ? t('expired') 
                      : days === 0 
                        ? t('expiryToday') 
                        : t(days === 1 ? 'expiryDay' : 'expiryDays', { days });

                    return (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50 group hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl ${mappedCat.bg} ${mappedCat.color}`}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900">{item.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${getStatusColor(item.expiryDate)}`}>
                                {urgency}
                              </span>
                              <span className="text-xs text-slate-400">
                                {format(parseISO(item.expiryDate), language === 'fr' ? 'd MMM' : 'MMM do', { locale: dateLocale })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title={t('btnRemoveItem')}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Saved Recipes Panel */}
          <div className="bg-white border rounded-2xl shadow-sm p-6 overflow-hidden">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-indigo-500" /> {t('titleSavedRecipes')}
            </h2>
            
            {savedRecipes.length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                <ChefHat className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p>{t('emptySavedRecipes')}</p>
                <p className="text-xs text-slate-400 mt-1">{t('savedRecipesInstruction')}</p>
              </div>
            ) : (
              <div className="grid gap-3">
                <AnimatePresence>
                  {savedRecipes.map(recipe => {
                    const isExpanded = expandedRecipeId === recipe.id;
                    return (
                      <motion.div
                        key={recipe.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="border border-slate-100 rounded-xl bg-slate-50/50 hover:shadow-sm transition-all overflow-hidden"
                      >
                        <div 
                          className="flex items-center justify-between p-4 cursor-pointer select-none"
                          onClick={() => setExpandedRecipeId(isExpanded ? null : recipe.id)}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-sm ${
                              recipe.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                              recipe.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {recipe.difficulty === 'Easy' ? t('difficultyEasy') :
                               recipe.difficulty === 'Medium' ? t('difficultyMedium') :
                               t('difficultyHard')}
                            </span>
                            <h3 className="font-semibold text-slate-900">{recipe.title}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSavedRecipe(recipe.id);
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title={t('btnDeleteSavedRecipe')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                        </div>
                        
                        {isExpanded && (
                          <div className="px-4 pb-4 border-t border-slate-100/50 pt-4 space-y-4 bg-white">
                            <p className="text-sm text-slate-600">{recipe.description}</p>
                            
                            <div>
                              <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2">{t('usedIngredients')}</h4>
                              <div className="flex flex-wrap gap-1">
                                {recipe.ingredientsUsed.map((ing, i) => (
                                  <span key={i} className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-md">
                                    {ing}
                                  </span>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Info className="w-3 h-3 text-slate-400" /> {t('instructions')}
                              </h4>
                              <ol className="list-decimal list-inside space-y-1">
                                {recipe.instructions.map((step, i) => (
                                  <li key={i} className="text-sm text-slate-600 leading-relaxed pl-1">
                                    <span className="pl-1">{step}</span>
                                  </li>
                                ))}
                              </ol>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Recipe Panel */}
        <div className="space-y-6">
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2 text-indigo-900">
              <ChefHat className="w-5 h-5" /> {t('titleSuggestions')}
            </h2>
            <p className="text-sm text-indigo-700/70 mb-6">
              {t('subtitleSuggestions')}
            </p>

            {recipeError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm mb-4">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                {recipeError}
              </div>
            )}

            {!recipes && !isLoadingRecipes && !recipeError && (
              <div className="text-center py-8">
                <Sparkles className="w-8 h-8 text-indigo-300 mx-auto mb-3" />
                <p className="text-sm text-indigo-600 font-medium pb-2">{t('suggestionsInstruction')}</p>
              </div>
            )}

            {isLoadingRecipes && (
              <div className="space-y-4">
                {[1, 2].map(i => (
                  <div key={i} className="animate-pulse bg-white p-4 rounded-xl border border-indigo-100 space-y-3">
                    <div className="h-5 bg-indigo-100 rounded w-2/3" />
                    <div className="h-4 bg-indigo-50 rounded w-full" />
                    <div className="h-4 bg-indigo-50 rounded w-4/5" />
                  </div>
                ))}
              </div>
            )}

            {recipes && (
              <div className="space-y-4">
                {recipes.map((recipe, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    key={idx} 
                    className="bg-white p-5 rounded-xl border border-indigo-100 shadow-sm"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-slate-800 pr-2">{recipe.title}</h3>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-sm ${
                          recipe.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                          recipe.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {recipe.difficulty === 'Easy' ? t('difficultyEasy') :
                           recipe.difficulty === 'Medium' ? t('difficultyMedium') :
                           t('difficultyHard')}
                        </span>
                        
                        {(() => {
                          const isSaved = savedRecipes.some(r => r.title.toLowerCase() === recipe.title.toLowerCase());
                          return (
                            <button
                              onClick={() => handleSaveRecipe(recipe)}
                              disabled={isSaved}
                              className={`p-1 rounded-md transition-colors ${
                                isSaved 
                                  ? 'text-indigo-600 bg-indigo-50 cursor-default' 
                                  : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-50'
                              }`}
                              title={isSaved ? t('btnSavedToRecipes') : t('btnSaveRecipe')}
                            >
                              <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-indigo-600' : ''}`} />
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                    
                    <p className="text-sm text-slate-600 mb-4">{recipe.description}</p>
                    
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2">{t('usesIngredients')}</h4>
                      <div className="flex flex-wrap gap-1">
                        {recipe.ingredientsUsed.map((ing, i) => (
                          <span key={i} className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-md">
                            {ing}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Info className="w-3 h-3 text-slate-400" /> {t('instructions')}
                      </h4>
                      <ol className="list-decimal list-inside space-y-1">
                        {recipe.instructions.map((step, i) => (
                          <li key={i} className="text-sm text-slate-600 leading-relaxed pl-1">
                            <span className="pl-1">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Item Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="flex justify-between items-center p-6 bg-slate-50 border-b border-slate-100">
                <h3 className="text-lg font-semibold text-slate-900">{t('modalTitle')}</h3>
                <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleAddItem} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('labelItemName')}</label>
                  <input
                    type="text"
                    required
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder={t('placeholderItemName')}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('labelCategory')}</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {CATEGORIES.map(cat => (
                      <button
                        type="button"
                        key={cat.name}
                        onClick={() => setNewItemCategory(cat.name)}
                        className={`flex items-center gap-2 p-2 rounded-lg text-sm transition-all border ${
                          newItemCategory === cat.name 
                            ? `${cat.bg} ${cat.color} border-transparent font-medium shadow-sm` 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <cat.icon className="w-4 h-4" />
                        {t(getCategoryTranslationKey(cat.name))}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('labelExpiresIn')}</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="0"
                      required
                      value={newItemExpiryDays}
                      onChange={(e) => setNewItemExpiryDays(e.target.value)}
                      className="w-24 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                    <span className="text-sm text-slate-500">{t('labelDays')}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    {t('btnCancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 font-medium text-white bg-emerald-600 rounded-lg shadow-sm hover:bg-emerald-700 transition-colors"
                  >
                    {t('btnSaveItem')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
