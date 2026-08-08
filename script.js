function showPage(pageId) {
    const pages = ['login-page', 'signup-page', 'main-page', 'dashboard-page', 'report-page', 'more-page'];
    pages.forEach(id => {
        const page = document.getElementById(id);
        if (page) {
            page.classList.add('hidden');
        }
    });

    const target = document.getElementById(pageId);
    if (target) {
        target.classList.remove('hidden');
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
}