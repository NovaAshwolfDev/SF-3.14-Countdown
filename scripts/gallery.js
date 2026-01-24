import { JSONC, Time } from "./jsonc.js";

let jsonc = new JSONC();
let timerInd = new Time();
let currentIndex = 0;
let bannersArray = [];

const imageContainer = document.querySelector(".image-container");
// const prevButton = document.getElementById("prevButton");
// const nextButton = document.getElementById("nextButton");

let banners = [];
let autoSlideTimer;

// Smoothly resize container to match the active image
function resizeContainerToImage(img) {
    const ratio = img.naturalHeight / img.naturalWidth;
    const width = imageContainer.clientWidth;
    const newHeight = width * ratio;
    imageContainer.style.height = `${newHeight}px`;
}

// Show next/previous banner
function showBanner(direction = 1) {
    const current = banners[currentIndex];
    const nextIndex = (currentIndex + direction + banners.length) % banners.length;
    const next = banners[nextIndex];

    next.classList.remove("active", "exiting");
    next.style.transition = "none";
    next.style.left = direction > 0 ? "100%" : "-100%";

    void next.offsetWidth; // force reflow

    next.style.transition = "all 0.6s ease";
    current.style.transition = "all 0.6s ease";

    current.style.left = direction > 0 ? "-100%" : "100%";
    next.style.left = "0%";

    current.classList.remove("active");
    next.classList.add("active");

    // Resize container to next image
    if (next.complete) {
        resizeContainerToImage(next);
    } else {
        next.onload = () => resizeContainerToImage(next);
    }

    setTimeout(() => {
        current.style.transition = "none";
        current.style.left = direction > 0 ? "100%" : "-100%";
    }, 700);

    currentIndex = nextIndex;
}

// Automatic sliding
function startAutoSlide() {
    autoSlideTimer = setInterval(() => {
        showBanner(1);
    }, 6000);
}

function resetAutoSlide() {
    clearInterval(autoSlideTimer);
    startAutoSlide();
}

// Load banners from JSONC
jsonc.loadJsonc(
    "https://raw.githubusercontent.com/NovaAshwolfDev/Secret-Repo/refs/heads/main/image-config.jsonc"
).then((data) => {
    bannersArray = data.banners;
    imageContainer.innerHTML = "";

    bannersArray.forEach((banner, i) => {
        const img = document.createElement("img");
        img.src = banner.url;
        img.className = "carousel-img";
        img.style.left = i === 0 ? "0%" : "100%"; // first image visible
        if (i === 0) img.classList.add("active");
        imageContainer.appendChild(img);
        banners.push(img);
    });

    // Resize container to first image
    const firstImage = banners[0];
    if (firstImage.complete) {
        resizeContainerToImage(firstImage);
    } else {
        firstImage.onload = () => resizeContainerToImage(firstImage);
    }

    // Optional: Previous/Next buttons
    // prevButton.addEventListener("click", () => { showBanner(-1); resetAutoSlide(); });
    // nextButton.addEventListener("click", () => { showBanner(1); resetAutoSlide(); });

    startAutoSlide();
});
