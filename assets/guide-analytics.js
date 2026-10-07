window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
if (!document.body.classList.contains('home-page')) {
  gtag('js', new Date());
  gtag('config', 'G-6WW5KF32KS');
}
document.addEventListener('click', function (event) {
  var link = event.target.closest('a[data-guide-action], a.home-scene');
  if (!link) return;
  var match = (link.classList.contains('home-scene') ? new URL(link.href).pathname : location.pathname).match(/\/guides\/([^/]+)\//);
  gtag('event', link.classList.contains('home-scene') ? 'guide_select' : (link.dataset.guideAction === 'purchase' ? 'purchase_button_click' : 'guide_product_click'), {
    product_id: link.dataset.productId || '',
    guide_type: match ? match[1] : '',
    cta_position: 'guide_comparison',
    link_url: link.href,
    transport_type: 'beacon'
  });
});
