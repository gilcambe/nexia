(function () {
  function carregarInstagramBanner() {
    let banner = document.getElementById('instagram-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'instagram-banner';
      banner.className = 'banner';
      banner.style.display = 'none';
      if (document.body) {
        document.body.insertBefore(banner, document.body.firstChild);
      }
    }

    fetch('/api/instagram-handle')
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        var handle = (data && (data.handle || data.instagram) || '').toString().trim().replace(/^@/, '');
        var bannerEl = document.getElementById('instagram-banner');
        if (!bannerEl) return;

        if (handle) {
          bannerEl.textContent = '📸 Siga nosso novo Instagram ';
          var link = document.createElement('a');
          link.href = 'https://instagram.com/' + encodeURIComponent(handle);
          link.target = '_blank';
          link.rel = 'noopener';
          link.style.color = 'inherit';
          link.style.textDecoration = 'underline';
          link.textContent = '@';

          var handleSpan = document.createElement('span');
          handleSpan.id = 'handle';
          handleSpan.textContent = handle;

          link.appendChild(handleSpan);
          bannerEl.appendChild(link);
          bannerEl.style.display = 'block';
        } else {
          bannerEl.style.display = 'none';
        }
      })
      .catch(function () {
        var bannerEl = document.getElementById('instagram-banner');
        if (bannerEl) bannerEl.style.display = 'none';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', carregarInstagramBanner);
  } else {
    carregarInstagramBanner();
  }
})();
