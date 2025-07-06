import * as THREE from "three";

let scene, camera, renderer, digitGroup;
let timerRunning = false;
let isPaused = false;
let totalSeconds = 0;
let currentSeconds = 0;
let timerInterval;

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
  }

  // If screen is narrow, move camera back to fit width
  if (aspect < 0.8) {
    zoom += 8;
  }

  // Set camera position
  camera.position.z = zoom;
}

function setClickHandlers() {
  document.getElementById("start-button").addEventListener("click", startTimer);
  document.getElementById("pause-button").addEventListener("click", pauseTimer);
  document.getElementById("stop-button").addEventListener("click", resetTimer);
}

function init() {
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

  setClickHandlers();

  adjustCameraForViewport();
  updateDisplay("00:00:05:00");

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

function createColon(offsetX = 0) {
  const colonGroup = new THREE.Group();

  const dotGeometry = new THREE.SphereGeometry(0.1, 8, 8);
  const dotMaterial = new THREE.MeshPhongMaterial({
    color: 0x00ff00,
    emissive: 0x002200,
  });

  const topDot = new THREE.Mesh(dotGeometry, dotMaterial);
  topDot.position.set(offsetX, 0.5, 0);

  const bottomDot = new THREE.Mesh(dotGeometry, dotMaterial);
  bottomDot.position.set(offsetX, -0.5, 0);

  colonGroup.add(topDot);
  colonGroup.add(bottomDot);

  return colonGroup;
}

function formatTime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${days.toString().padStart(2, "0")}:${hours
    .toString()
    .padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

function startTimer() {
  if (!timerRunning && !isPaused) {
    const days = parseInt(document.getElementById("days").value) || 0;
    const hours = parseInt(document.getElementById("hours").value) || 0;
    const minutes = parseInt(document.getElementById("minutes").value) || 0;
    const seconds = parseInt(document.getElementById("seconds").value) || 0;

    totalSeconds = days * 86400 + hours * 3600 + minutes * 60 + seconds;
    currentSeconds = totalSeconds;

    if (totalSeconds <= 0) {
      document.getElementById("status").textContent = "Please set a valid time";
      return;
    }
  }

  timerRunning = true;
  isPaused = false;
  document.getElementById("status").textContent = "Timer running...";

  timerInterval = setInterval(() => {
    currentSeconds--;
    updateDisplay(formatTime(currentSeconds));

    if (currentSeconds <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      document.getElementById("status").textContent = "Time's up!";

      // Flash effect
      digitGroup.children.forEach((child) => {
        child.children.forEach((segment) => {
          if (segment.material) {
            segment.material.color.setHex(0xff0000);
            segment.material.emissive.setHex(0x440000);
          }
        });
      });
    }
  }, 1000);
}

function pauseTimer() {
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
    isPaused = true;
    document.getElementById("status").textContent = "Timer paused";
  }
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  isPaused = false;
  currentSeconds = 0;
  document.getElementById("status").textContent = "Ready to start";
  updateDisplay("00:00:05:00");
}

// Add at the top with other global variables
let lastRotationY = 0;

function animate() {
  requestAnimationFrame(animate);

  // Subtle rotation animation - continue from last position
  lastRotationY += 0.005;
  digitGroup.rotation.y = lastRotationY;

  // Gentle floating animation
  digitGroup.position.y = Math.sin(Date.now() * 0.002) * 0.5;

  renderer.render(scene, camera);
}

function updateDisplay(timeString) {
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
      digitGroup.add(createColon(xOffset / scaleFactor));
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

  if (timerRunning) {
    updateDisplay(formatTime(currentSeconds));
  } else {
    updateDisplay("00:00:05:00");
  }
});

init();
