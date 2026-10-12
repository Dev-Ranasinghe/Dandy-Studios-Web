/** Session flag: once the site loader has played, later page loads in the session skip it. */
export const LOADER_SEEN_KEY = "dandy-loaded";
export const LOADER_SEEN_ATTR = "data-site-loaded";

/** Runs in <head> before first paint: marks a returning page so the loader never shows. */
export const LOADER_BOOT = `try{if(sessionStorage.getItem("${LOADER_SEEN_KEY}"))document.documentElement.setAttribute("${LOADER_SEEN_ATTR}","")}catch(e){}`;
