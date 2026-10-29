// Tipp auf eine Benachrichtigung (installierte Web-App): App nach vorn holen und die Mitteilung öffnen.
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var id = event.notification.data && event.notification.data.inboxId;
  event.waitUntil(
    (async function () {
      var list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if ('focus' in c) {
          await c.focus();
          if (id) c.postMessage({ type: 'filamenthub-open-inbox', id: id });
          return;
        }
      }
      var url = self.registration.scope + (id ? '?inbox=' + encodeURIComponent(id) : '');
      await self.clients.openWindow(url);
    })()
  );
});
