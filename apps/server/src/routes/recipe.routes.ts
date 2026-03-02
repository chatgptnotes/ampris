import { Router } from 'express';
import * as recipeCtrl from '../controllers/recipe.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', recipeCtrl.getRecipes);
router.post('/', recipeCtrl.createRecipe);
router.put('/:id', recipeCtrl.updateRecipe);
router.delete('/:id', recipeCtrl.deleteRecipe);
router.post('/:id/execute', recipeCtrl.executeRecipe);
router.post('/:id/stop', recipeCtrl.stopRecipe);
router.get('/:id/status', recipeCtrl.getRecipeStatus);

export default router;
