window.dataLayer = window.dataLayer || [];
if (typeof window.gtag !== 'function') {
  window.gtag = function () { window.dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', 'G-6WW5KF32KS');
}
var productHelp = document.querySelector('[data-purchase-help] [data-product-id]');
if (productHelp) {
  gtag('event', 'product_guide_view', { product_id: productHelp.dataset.productId });
}
document.addEventListener('click', function (event) {
  var link = event.target.closest('a[data-guide-action], a.home-scene');
  if (!link) return;
  var match = (link.classList.contains('home-scene') ? new URL(link.href).pathname : location.pathname).match(/\/guides\/([^/]+)\//);
  var action = link.dataset.guideAction;
  var eventName = link.classList.contains('home-scene') ? 'guide_select' :
    action === 'shipping' ? 'shipping_info_click' :
    action === 'shop' ? 'shop_button_click' :
    action === 'purchase' ? 'purchase_button_click' :
    document.body.classList.contains('home-page') ? 'product_select' : 'guide_product_click';
  gtag('event', eventName, {
    product_id: link.dataset.productId || '',
    guide_type: match ? match[1] : '',
    cta_position: link.dataset.guidePosition || (document.body.classList.contains('home-page') ? 'home' : action === 'shipping' ? 'product_shipping' : 'guide_comparison'),
    link_url: link.href,
    transport_type: 'beacon'
  });
});
