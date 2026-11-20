document.addEventListener("DOMContentLoaded", function () {
  const mobileMenuButton = document.querySelector(".mobile-btn");
  const mobileMenu = document.getElementById("mobile-menu");
  const overlay = document.querySelector(".overlay");
  const nav = document.querySelector("[data-nav]");
  if (!mobileMenuButton || !mobileMenu) return;

  // While the sheet is open the bar shows its dark theme (black bar, white
  // logo and close button) even at the top of the page. `data-scrolled` is the
  // nav's single theme switch, so we set it here and give it back to the
  // scroll logic on close: kept if the nav is fixed (really scrolled), removed
  // otherwise.
  const setNavDark = (dark) => {
    if (!nav) return;
    if (dark) nav.dataset.scrolled = "";
    else if (!nav.classList.contains("fixed")) delete nav.dataset.scrolled;
  };

  const setOpen = (open) => {
    mobileMenu.classList.toggle("hidden", !open);
    overlay.classList.toggle("hidden", !open);
    setNavDark(open);
    mobileMenuButton.setAttribute("aria-expanded", String(open));
    mobileMenuButton.setAttribute(
      "aria-label",
      open ? "Close menu" : "Open menu",
    );
  };
  const isOpen = () =>
    mobileMenuButton.getAttribute("aria-expanded") === "true";

  mobileMenuButton.addEventListener("click", () => setOpen(!isOpen()));

  // Close when a link is chosen (anchors scroll the same page, so the sheet
  // would otherwise stay open over the target section), when the dimmed page
  // is tapped, or on Escape
  mobileMenu.addEventListener("click", (e) => {
    if (e.target.closest("a")) setOpen(false);
  });
  overlay.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) setOpen(false);
  });
});
