document.addEventListener("DOMContentLoaded", function () {
  const mobileMenuButton = document.querySelector(".mobile-btn");
  const mobileMenu = document.getElementById("mobile-menu");
  const overlay = document.querySelector(".overlay");
  if (!mobileMenuButton || !mobileMenu) return;

  const setOpen = (open) => {
    mobileMenu.classList.toggle("hidden", !open);
    overlay.classList.toggle("hidden", !open);
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
