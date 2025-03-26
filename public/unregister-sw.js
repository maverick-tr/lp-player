// Script to unregister ServiceWorker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (let registration of registrations) {
      registration.unregister();
      console.log('ServiceWorker unregistered');
    }
    // Force reload without ServiceWorker
    window.location.reload();
  });
} 