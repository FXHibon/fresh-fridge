import React, { createContext, useContext, useState } from 'react';
import { fr, enUS } from 'date-fns/locale';

export type Language = 'en' | 'fr';

export const translations = {
  en: {
    // Header
    brandFresh: 'Fresh',
    brandFridge: 'Fridge',
    subtitle: 'Track expiry dates and minimize food waste.',
    btnScan: 'Scan',
    btnScanning: 'Scanning...',
    btnAiRecipes: 'AI Recipes',
    btnAddFood: 'Add Food',
    
    // Inventory
    titleInventory: 'Current Inventory',
    emptyFridge: 'Your fridge is empty!',
    addSomeItems: 'Add some items',
    btnRemoveItem: 'Remove item',
    expiryToday: 'Expires Today',
    expired: 'Expired',
    expiryDays: 'Expires in {days} days',
    expiryDay: 'Expires in {days} day',
    
    // Categories
    catProduce: 'Produce',
    catDairy: 'Dairy',
    catMeat: 'Meat',
    catPantry: 'Pantry',
    catOther: 'Other',
    
    // Saved Recipes
    titleSavedRecipes: 'Saved Recipes',
    emptySavedRecipes: 'No saved recipes yet.',
    savedRecipesInstruction: 'Generate recipes on the right and click the bookmark icon to save them!',
    btnDeleteSavedRecipe: 'Delete saved recipe',
    usedIngredients: 'Used ingredients:',
    instructions: 'Instructions:',
    difficultyEasy: 'Easy',
    difficultyMedium: 'Medium',
    difficultyHard: 'Hard',
    
    // Suggestions
    titleSuggestions: 'Recipe Suggestions',
    subtitleSuggestions: 'AI suggests what to cook to minimize waste based on items expiring soon.',
    suggestionsInstruction: 'Click "AI Recipes" to generate ideas.',
    btnSavedToRecipes: 'Saved to Recipes',
    btnSaveRecipe: 'Save Recipe',
    usesIngredients: 'Uses these ingredients:',
    
    // Modal
    modalTitle: 'Add to Fridge',
    labelItemName: 'Item Name',
    placeholderItemName: 'e.g. Greek Yogurt',
    labelCategory: 'Category',
    labelExpiresIn: 'Expires in (days)',
    labelDays: 'days',
    btnCancel: 'Cancel',
    btnSaveItem: 'Save Item',
    
    // Notifications & Errors
    errScanFailed: 'Failed to scan groceries. Please ensure the image is clear and you have configured the Gemini API key.',
    errRecipesFailed: 'Error fetching recipes. Please ensure your GEMINI_API_KEY is configured in the environment.',
    noItemsToGenerate: 'Please add items to your fridge first to generate recipes.',
  },
  fr: {
    // Header
    brandFresh: 'Fresh',
    brandFridge: 'Fridge',
    subtitle: 'Suivez les dates d\'expiration et minimisez le gaspillage alimentaire.',
    btnScan: 'Numériser',
    btnScanning: 'Analyse...',
    btnAiRecipes: 'Recettes IA',
    btnAddFood: 'Ajouter',
    
    // Inventory
    titleInventory: 'Inventaire Actuel',
    emptyFridge: 'Votre réfrigérateur est vide !',
    addSomeItems: 'Ajouter des articles',
    btnRemoveItem: 'Supprimer l\'article',
    expiryToday: 'Expire aujourd\'hui',
    expired: 'Expiré',
    expiryDays: 'Expire dans {days} jours',
    expiryDay: 'Expire dans {days} jour',
    
    // Categories
    catProduce: 'Fruits & Légumes',
    catDairy: 'Produits Laitiers',
    catMeat: 'Viandes & Poissons',
    catPantry: 'Épicerie',
    catOther: 'Autre',
    
    // Saved Recipes
    titleSavedRecipes: 'Recettes Enregistrées',
    emptySavedRecipes: 'Aucune recette enregistrée pour le moment.',
    savedRecipesInstruction: 'Générez des recettes à droite et cliquez sur l\'icône de favori pour les enregistrer !',
    btnDeleteSavedRecipe: 'Supprimer la recette',
    usedIngredients: 'Ingrédients utilisés :',
    instructions: 'Instructions :',
    difficultyEasy: 'Facile',
    difficultyMedium: 'Moyen',
    difficultyHard: 'Difficile',
    
    // Suggestions
    titleSuggestions: 'Suggestions de Recettes',
    subtitleSuggestions: 'L\'IA suggère des recettes pour réduire le gaspillage selon les articles qui expirent bientôt.',
    suggestionsInstruction: 'Cliquez sur « Recettes IA » pour générer des idées.',
    btnSavedToRecipes: 'Enregistré',
    btnSaveRecipe: 'Enregistrer la recette',
    usesIngredients: 'Utilise ces ingrédients :',
    
    // Modal
    modalTitle: 'Ajouter au frigo',
    labelItemName: 'Nom de l\'article',
    placeholderItemName: 'ex. Yaourt grec',
    labelCategory: 'Catégorie',
    labelExpiresIn: 'Expire dans (jours)',
    labelDays: 'jours',
    btnCancel: 'Annuler',
    btnSaveItem: 'Enregistrer',
    
    // Notifications & Errors
    errScanFailed: 'Échec de la numérisation des courses. Veuillez vous assurer que l\'image est claire et que la clé API Gemini est configurée.',
    errRecipesFailed: 'Erreur lors de la génération des recettes. Veuillez vous assurer que votre GEMINI_API_KEY est configurée.',
    noItemsToGenerate: 'Veuillez d\'abord ajouter des articles dans votre frigo pour générer des recettes.',
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations.en, replacements?: Record<string, string | number>) => string;
  dateLocale: typeof fr | typeof enUS;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('fresh-fridge-lang');
      if (saved === 'en' || saved === 'fr') return saved;
    } catch {}

    try {
      const browserLang = navigator.language || (navigator.languages && navigator.languages[0]) || 'en';
      return browserLang.toLowerCase().startsWith('fr') ? 'fr' : 'en';
    } catch {
      return 'en';
    }
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('fresh-fridge-lang', lang);
    } catch (e) {
      console.warn('Failed to save language to localStorage', e);
    }
  };

  const t = (key: keyof typeof translations.en, replacements?: Record<string, string | number>): string => {
    let text = translations[language][key] || translations.en[key] || String(key);
    if (replacements) {
      Object.entries(replacements).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  };

  const dateLocale = language === 'fr' ? fr : enUS;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dateLocale }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
