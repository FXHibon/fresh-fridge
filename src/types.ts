export interface FoodItem {
  id: string;
  name: string;
  category: string;
  addedDate: string;
  expiryDate: string;
}

export interface RecipeSuggestion {
  title: string;
  description: string;
  ingredientsUsed: string[];
  instructions: string[];
  difficulty: "Easy" | "Medium" | "Hard";
}

export interface SavedRecipe extends RecipeSuggestion {
  id: string;
  savedAt: string;
}

