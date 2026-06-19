/** Scroll the document to top after layout (e.g. wizard step change, same-route view swap). */
export function scrollPageToTop() {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            window.scrollTo(0, 0);
        });
    });
}
