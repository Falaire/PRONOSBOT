// Service worker volontairement minimal : son seul rôle est de satisfaire le critère technique
// d'installabilité de Chrome (qui exige un service worker avec un gestionnaire d'événement
// "fetch" enregistré pour proposer "Installer l'application" plutôt que "Créer un raccourci").
// Honnêteté : il ne met RIEN en cache et ne fournit AUCUN mode hors-ligne — chaque requête part
// simplement sur le réseau normalement, exactement comme sans service worker. On ne prétend pas
// offrir un vrai support hors-ligne qu'on n'a pas construit.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
