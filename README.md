# Studio LesViolets

Éditeur local de visuels éditoriaux pour LesViolets.com. Import, cadrage, texte enrichi et export sont effectués dans le navigateur ; les images importées ne sont envoyées à aucun serveur.

## Installation et lancement

```sh
npm install
npm run dev
```

Node.js 20.19+ ou 22.12+ est requis par Vite 8.

## Vérifications

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

## Utilisation

1. Importez une image JPEG, PNG ou WebP depuis l’onglet **Image**, ou déposez-la sur l’aperçu.
2. Faites glisser la photo pour régler son cadrage et utilisez le curseur de zoom. **Réinitialiser le cadrage** restaure le cover centré.
3. Dans **Texte**, modifiez le titre ou la description, choisissez l’élément, ajustez sa taille, son interligne et son alignement.
4. Pour colorer un passage, sélectionnez-le dans le champ de texte, puis ouvrez **Style** et choisissez une couleur. Les autres portions conservent leur mise en forme.
5. Choisissez un format de sortie et exportez en PNG ou JPEG. Les dimensions du fichier correspondent au format sélectionné.

## Configuration éditoriale

- **Palette** : modifiez `THEME_COLORS` dans `src/config/editor.ts` (six couleurs affichées).
- **Polices** : ajoutez ou remplacez les entrées de `FONTS` dans ce même fichier. Renseignez un libellé, une famille CSS et uniquement les graisses disponibles. Les polices système actuelles ne nécessitent aucun chargement distant. Pour une police locale, déclarez-la dans CSS avec `@font-face` ; pour une future police Google Fonts, configurez son chargement puis vérifiez sa disponibilité avant export.
- **Formats** : ajoutez ou modifiez les entrées de `OUTPUT_FORMATS` dans `src/config/editor.ts`. Les positions du texte et du cadrage sont proportionnelles, ce qui permet leur adaptation au changement de format.
- **Export** : modifiez `EXPORT_JPEG_QUALITY` dans `src/config/editor.ts`. L’export PNG utilise la qualité sans perte du navigateur.

## Fonctionnalités

- Aperçu Canvas à la résolution exacte du format, interaction tactile/souris et déplacement du recadrage.
- Trois formats : carré 1080 × 1080, portrait 1080 × 1350 et paysage 1200 × 630.
- Deux éléments de texte indépendants, dont styles typographiques, taille, graisse, interligne, alignement et position.
- Segments de texte multicolores avec sélection native dans le champ de saisie.
- Export PNG/JPEG côté client et indications d’état/erreur.
- Mise en page responsive desktop et mobile.

## Limites connues

- Les polices système sont disponibles hors ligne. L’ajout d’une police web doit inclure son chargement effectif avant export.
- Le déplacement des textes se fait par glisser sur le visuel ou avec les curseurs X/Y ; les positions sont conservées proportionnellement lorsque le format change, mais une vérification éditoriale reste nécessaire.
- L’export nécessite une image importée et un navigateur moderne avec Canvas, `createImageBitmap` et `toBlob`.
