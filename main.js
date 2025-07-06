import * as THREE from "three";

let scene, camera, renderer, digitGroup;
let targetDate; // The date we're counting down to
let timerInterval;
let lastRotationY = 0;
let colonVisible = true;

// Digit patterns for 7-segment display style
const digitPatterns = {
  0: [1, 1, 1, 1, 1, 1, 0],
  1: [0, 1, 1, 0, 0, 0, 0],
  2: [1, 1, 0, 1, 1, 0, 1],
  3: [1, 1, 1, 1, 0, 0, 1],
  4: [0, 1, 1, 0, 0, 1, 1],
  5: [1, 0, 1, 1, 0, 1, 1],
  6: [1, 0, 1, 1, 1, 1, 1],
  7: [1, 1, 1, 0, 0, 0, 0],
  8: [1, 1, 1, 1, 1, 1, 1],
  9: [1, 1, 1, 1, 0, 1, 1],
  ":": [0, 0, 0, 0, 0, 0, 0], // colon (special case)
};

function adjustCameraForViewport() {
  // Adjust camera position based on viewport size
  const aspect = window.innerWidth / window.innerHeight;

  // Base zoom level, adjusted for aspect ratio
  let zoom = 15;

  // If screen is wide and short, move camera back to fit height
  if (aspect > 1.5) {
    zoom += 10;
    console.debug("Wide screen detected, adjusting zoom for height.");
  }

  // If screen is narrow, move camera back to fit width
  if (aspect < 0.8) {
    zoom += 8;
    console.debug("Narrow screen detected, adjusting zoom for width.");
  }

  // Set camera position
  camera.position.z = zoom;
}

function init() {
  // Set our target date (example: December 31, 2025)
  targetDate = new Date("December 31, 2025 23:59:59");

  // Display the target date in the header
  const dateElement = document.getElementById("target-date");
  dateElement.textContent = targetDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor("black", 1);
  document.getElementById("container").appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);

  const pointLight = new THREE.PointLight(0x00ff00, 0.5, 100);
  pointLight.position.set(0, 0, 10);
  scene.add(pointLight);

  digitGroup = new THREE.Group();
  scene.add(digitGroup);

  camera.position.z = 15;

  adjustCameraForViewport();

  // Start the countdown immediately
  startCountdown();

  animate();
}

function createSegment(x, y, z, isHorizontal = false) {
  const geometry = isHorizontal
    ? new THREE.BoxGeometry(1.5, 0.2, 0.3)
    : new THREE.BoxGeometry(0.2, 1.5, 0.3);

  const material = new THREE.MeshPhongMaterial({
    color: 0x00ff00,
    emissive: 0x002200,
    transparent: true,
    opacity: 0.9,
  });

  const segment = new THREE.Mesh(geometry, material);
  segment.position.set(x, y, z);
  return segment;
}

function createDigit(digit, offsetX = 0) {
  const digitGroup = new THREE.Group();
  const pattern = digitPatterns[digit] || [0, 0, 0, 0, 0, 0, 0];

  // Segment positions for 7-segment display
  const segments = [
    // Top
    createSegment(offsetX, 2, 0, true),
    // Top right
    createSegment(offsetX + 0.8, 1, 0),
    // Bottom right
    createSegment(offsetX + 0.8, -1, 0),
    // Bottom
    createSegment(offsetX, -2, 0, true),
    // Bottom left
    createSegment(offsetX - 0.8, -1, 0),
    // Top left
    createSegment(offsetX - 0.8, 1, 0),
    // Middle
    createSegment(offsetX, 0, 0, true),
  ];

  segments.forEach((segment, index) => {
    if (pattern[index]) {
      segment.material.opacity = 1;
      segment.material.emissive.setHex(0x004400);
    } else {
      segment.material.opacity = 0.1;
      segment.material.emissive.setHex(0x000000);
    }
    digitGroup.add(segment);
  });

  return digitGroup;
}

function createColon(offsetX = 0, isVisible = true) {
  const colonGroup = new THREE.Group();

  const dotGeometry = new THREE.SphereGeometry(0.2, 8, 8);
  const dotMaterial = new THREE.MeshPhongMaterial({
    color: 0x00ff00,
    emissive: 0x002200,
    transparent: true,
    opacity: isVisible ? 1.0 : 0.1,
  });

  const topDot = new THREE.Mesh(dotGeometry, dotMaterial);
  topDot.position.set(offsetX, 0.5, 0);

  const bottomDot = new THREE.Mesh(dotGeometry, dotMaterial);
  bottomDot.position.set(offsetX, -0.5, 0);

  colonGroup.add(topDot);
  colonGroup.add(bottomDot);

  return colonGroup;
}

function formatTimeRemaining(totalSeconds) {
  const secondsInDay = 86400; // 24 * 60 * 60
  const days = Math.floor(totalSeconds / secondsInDay);
  const hours = Math.floor((totalSeconds % secondsInDay) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);

  return `${days.toString().padStart(2, "0")}:${hours
    .toString()
    .padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

function startCountdown() {
  updateCountdown();
  timerInterval = setInterval(updateCountdown, 1000);
}

function updateCountdown() {
  const now = new Date().getTime();
  const timeDifference = targetDate.getTime() - now;

  // toggle colon visibility every second
  colonVisible = !colonVisible;

  if (timeDifference <= 0) {
    clearInterval(timerInterval);
    updateDisplay("00:00:00:00");

    const statusElement = document.getElementById("status");
    if (statusElement) {
      statusElement.textContent = "Event has arrived!";
    }

    digitGroup.children.forEach((child) => {
      child.children.forEach((segment) => {
        if (segment.material) {
          segment.material.color.setHex(0xff0000);
          segment.material.emissive.setHex(0x440000);
        }
      });
    });

    return;
  }

  // Convert milliseconds to seconds
  const totalSeconds = Math.floor(timeDifference / 1000);

  // Update the display
  updateDisplay(formatTimeRemaining(totalSeconds), colonVisible);
}

function animate() {
  requestAnimationFrame(animate);

  // Subtle rotation animation - continue from last position
  lastRotationY += 0.005;
  digitGroup.rotation.y = lastRotationY;

  // Gentle floating animation
  digitGroup.position.y = Math.sin(Date.now() * 0.002) * 0.5;

  renderer.render(scene, camera);
}

function updateDisplay(timeString, showColons = true) {
  // Save the current rotation
  const currentRotation = digitGroup.rotation.y;

  while (digitGroup.children.length > 0) {
    digitGroup.remove(digitGroup.children[0]);
  }

  const chars = timeString.split("");

  // Calculate the total width needed
  const totalWidth = chars.length * 2 - 0.5;

  // Calculate optimal scale factor based on viewport width
  const viewportWidth = window.innerWidth;
  let scaleFactor = 1.0;

  // Adjust scale for smaller screens
  if (viewportWidth < 600) {
    scaleFactor = Math.max(0.7, viewportWidth / 600);
  }

  // Calculate starting position with scaling in mind
  let xOffset = -((totalWidth * scaleFactor) / 2);

  // Set the scale of the entire digit group
  digitGroup.scale.set(scaleFactor, scaleFactor, scaleFactor);

  chars.forEach((char, index) => {
    if (char === ":") {
      digitGroup.add(createColon(xOffset / scaleFactor, showColons));
      xOffset += 1.5 * scaleFactor;
    } else {
      digitGroup.add(createDigit(char, xOffset / scaleFactor));
      xOffset += 2.5 * scaleFactor;
    }
  });

  // Restore the previous rotation rather than setting a new one
  digitGroup.rotation.y = currentRotation;
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  adjustCameraForViewport();
});

init();
