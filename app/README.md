# Panell de manteniment · Hotel Rull

Adreça: **https://manteniment.hotelrull.com**

## Desenvolupament
```
npm install
npm run dev        # http://localhost:5173
```

## Publicar
```
npm run build      # genera dist/
```
Puja **el contingut** de `dist/` (inclòs el fitxer ocult `.htaccess`) a la carpeta arrel del subdomini
`manteniment.hotelrull.com` al hosting. Substitueix tot el que hi hagi; la carpeta `assets/` antiga es pot esborrar.

## Supabase · Authentication → URL Configuration
- Site URL: `https://manteniment.hotelrull.com`
- Redirect URLs: `https://manteniment.hotelrull.com/**` i `http://localhost:5173/**`

Sense això, l'enllaç d'entrada que arriba per correu no torna al panell.
