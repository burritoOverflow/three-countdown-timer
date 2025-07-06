import * as THREE from "three";

let scene, camera, renderer, digitGroup;
const targetDate = new Date("December 31, 2025 23:59:59");
let timerInterval;
let lastRotationY = 0;
let colonVisible = true;
let shouldRotate = true;

const DIGIT_WIDTH = 2.5; // Width of each digit in world units
const COLON_WIDTH = 1.5; // Width of each colon in world units
const VIEWPORT_USAGE = 0.8; // Use 80% of viewport width for the display

const GREEN_COLOR = 0x00ff00;

// Digit patterns for 7-segment display style
// where key is the digit and value is an array representing the segments that should be 'illuminated' for that given digit.
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

function init() {
  document.getElementById("target-date").textContent =
    targetDate.toLocaleDateString("en-US", {
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
  document.getElementById("container").appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 5, 5);
  scene.add(directionalLight);

  const pointLight = new THREE.PointLight(GREEN_COLOR, 0.5, 100);
  pointLight.position.set(0, 0, 10);
  scene.add(pointLight);

  digitGroup = new THREE.Group();
  scene.add(digitGroup);

  addEventListeners();

  // Position camera based on screen size
  adjustCameraPosition();
  startCountdown();
  animate();
}

function adjustCameraPosition() {
  // Base camera positions
  const baseZ = 20;
  const baseY = 1.4;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const aspectRatio = viewportWidth / viewportHeight;

  // Set a consistent camera position that will work across screen sizes
  // Our updateDisplay function will handle the proper scaling and positioning
  let zPosition = baseZ;

  // Make minimal adjustments for extreme aspect ratios
  if (aspectRatio > 2.5) {
    // Very wide screens may need camera pulled back slightly
    zPosition = baseZ * 1.1;
  } else if (aspectRatio < 0.6) {
    // Very tall/narrow screens may need camera pulled back slightly
    zPosition = baseZ * 1.2;
  }

  // Apply the camera position
  camera.position.z = zPosition;
  camera.position.y = baseY;
  camera.lookAt(0, 0, 0);
}

function createSegment(x, y, z, isHorizontal = false) {
  const DEPTH = 0.33; // Depth of the segment
  const LONG_SEGMENT_LENGTH = 1.5; // Length of horizontal segments
  const SHORT_SEGMENT_LENGTH = 0.2; // Length of vertical segments

  const geometry = isHorizontal
    ? new THREE.BoxGeometry(LONG_SEGMENT_LENGTH, SHORT_SEGMENT_LENGTH, DEPTH)
    : new THREE.BoxGeometry(SHORT_SEGMENT_LENGTH, LONG_SEGMENT_LENGTH, DEPTH);

  const material = new THREE.MeshPhongMaterial({
    color: GREEN_COLOR,
    emissive: 0x002200,
    transparent: true,
    opacity: 0.6,
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
      // If the segment should be lit
      segment.material.opacity = 1;
      segment.material.emissive.setHex(0x004400);
    } else {
      segment.material.opacity = 0.3; // "off" - segments not explicitly lit; keep them dim as a stylistic choice; toggle opacity here for visibility
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

  // toggle colon visibility every second (blink the colons)
  colonVisible = !colonVisible;

  // timer has expired
  if (timeDifference <= 0) {
    clearInterval(timerInterval);
    updateDisplay("00:00:00:00");

    const statusElement = document.getElementById("status");
    if (statusElement) {
      statusElement.textContent = "Event has arrived!";
    }

    // Change color to red when countdown completes
    digitGroup.children.forEach((child) => {
      child.children.forEach((segment) => {
        if (segment.material) {
          segment.material.color.setHex(0xff0000);
          segment.material.emissive.setHex(0x440000);
        }
      });
    });

    // Make sure camera position is adjusted for the final display
    adjustCameraPosition();
    return;
  }

  const totalSeconds = Math.floor(timeDifference / 1000);

  // Update the display
  updateDisplay(formatTimeRemaining(totalSeconds), colonVisible);
}

function animate() {
  requestAnimationFrame(animate);

  if (shouldRotate) {
    lastRotationY += 0.005;
    digitGroup.rotation.y = lastRotationY;
  }

  // Gentle floating animation
  digitGroup.position.y = Math.sin(Date.now() * 0.002);

  renderer.render(scene, camera);
}

function updateDisplay(timeString, showColons = true) {
  const currentRotation = digitGroup.rotation.y;

  while (digitGroup.children.length > 0) {
    digitGroup.remove(digitGroup.children[0]);
  }

  const chars = timeString.split("");

  // Calculate viewport dimensions in THREE.js world units
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const aspectRatio = viewportWidth / viewportHeight;

  // Calculate the field of view in radians
  const fovRadians = (camera.fov * Math.PI) / 180;

  // Calculate the visible width at the z-distance of our digits
  // This is how wide the viewport is in world units at our digit's z position
  const visibleWidth =
    2 * Math.tan(fovRadians / 2) * camera.position.z * aspectRatio;

  // Calculate total display width (without scaling)
  let totalDisplayWidth = 0;
  chars.forEach((char) => {
    totalDisplayWidth += char === ":" ? COLON_WIDTH : DIGIT_WIDTH;
  });

  // Calculate the scale that would make the display fit with equal margins on both sides
  const targetWidth = visibleWidth * VIEWPORT_USAGE;
  let scaleFactor = targetWidth / totalDisplayWidth;

  // Set reasonable bounds for the scale factor
  if (viewportWidth < 600) {
    // For mobile, don't let it get too small
    scaleFactor = Math.min(scaleFactor, 0.7);
  }

  // Clamp the scale factor to reasonable limits
  scaleFactor = Math.max(0.4, Math.min(scaleFactor, 1.4));

  // Now that we have the scale, calculate the starting x-position
  // This will ensure equal distance from both edges
  const scaledDisplayWidth = totalDisplayWidth * scaleFactor;
  let xOffset = -scaledDisplayWidth / 2;

  // Set the scale of the entire digit group
  digitGroup.scale.set(scaleFactor, scaleFactor, scaleFactor);

  // Position digits with proper spacing
  chars.forEach((char, _) => {
    if (char === ":") {
      // For colons, we need to divide by scaleFactor to counteract the group scaling
      digitGroup.add(createColon(xOffset / scaleFactor, showColons));
      xOffset += COLON_WIDTH * scaleFactor; // Add colon width (scaled)
    } else {
      digitGroup.add(createDigit(char, xOffset / scaleFactor));
      xOffset += DIGIT_WIDTH * scaleFactor; // Add digit width (scaled)
    }
  });

  // Restore the previous rotation rather than setting a new one
  digitGroup.rotation.y = currentRotation;
}

function addEventListeners() {
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Adjust camera position on resize
    adjustCameraPosition();

    // Re-render the countdown with the correct scale after resize
    updateCountdown();
  });

  function toggleRotation() {
    shouldRotate = !shouldRotate;
  }

  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "r") {
      toggleRotation();
    }
  });

  window.addEventListener("click", toggleRotation);

  window.addEventListener(
    "touchstart",
    (event) => {
      event.preventDefault();
      toggleRotation();
    },
    { passive: false }
  );
}

init();
