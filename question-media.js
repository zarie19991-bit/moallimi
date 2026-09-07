(() => {
  'use strict';
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const allowed = /^https:\/\/zarie19991-bit\.github\.io\/moallimi\/question-bank\/assets\/[a-f0-9]{64}\.png$/;
  function render(question) {
    const image = question?.image;
    if (!image || !allowed.test(String(image.url || ''))) return '';
    return `<figure class="question-figure"><a href="${escape(image.url)}" target="_blank" rel="noopener" aria-label="فتح الشكل بالحجم الكامل"><img src="${escape(image.url)}" alt="${escape(image.alt || 'الشكل المرتبط بالسؤال')}" loading="eager" decoding="async"></a><figcaption>اضغط على الشكل لتكبيره.</figcaption></figure>`;
  }
  window.NafesMedia = Object.freeze({ render });
})();
