import * as THREE from "three";
import { startTypewriter } from "./typewriter.js";

let scene, camera, renderer, digitGroup;

const targetDate = new Date("September 20, 2025 13:42:37");

let timerInterval;
let lastRotationY = 0;

// track colon visibility state; toggle every second
let colonVisible = true;

const animationState = {
  shouldRotate: false,
  shouldFloatAnimation: true, // oscillation on the y-axis
  shouldZoomAnimation: false, // oscillation on the z-axis
};

const DIGIT_WIDTH = 2.7; // Width of each digit in world units
const COLON_WIDTH = 2.5; // Width of each colon in world units

const VIEWPORT_USAGE = 0.9; // Use a defined percentage of viewport width for the display

const GREEN_COLOR = 0x00ff00;
const SPECULAR_COLOR = 0x222222;

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
  const fullDateTimeStr = targetDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!checkCountdownStatus().expired) {
    startTypewriter(
      "target-date",
      `Time remaining until ${fullDateTimeStr}`,
      65
    );
    document.title = `Countdown to ${fullDateTimeStr}`;
  }

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setClearColor(0x1a1a1a);
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
    transparent: true,
    opacity: 0.6,
    specular: SPECULAR_COLOR,
    shininess: 100,
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
    color: GREEN_COLOR,
    transparent: true,
    opacity: isVisible ? 1.0 : 0.1,
    specular: SPECULAR_COLOR,
    shininess: 100,
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

function checkCountdownStatus() {
  const now = new Date().getTime();
  const timeDifference = targetDate.getTime() - now;
  // meh
  const result = {
    expired: timeDifference <= 0,
    now,
    timeDifference,
  };
  return result;
}

// invoked during each update (given an interval) to handle countdown logic
function updateCountdown() {
  // toggle colon visibility every interval (blink the colons)
  colonVisible = !colonVisible;

  const { expired, _, timeDifference } = checkCountdownStatus();

  if (expired) {
    clearInterval(timerInterval);
    updateDisplay("00:00:00:00");

    const statusElement = document.getElementById("status");
    if (statusElement) {
      statusElement.textContent = "Event has arrived!";
    }

    const targetDateElement = document.getElementById("target-date");
    if (targetDateElement) {
      targetDateElement.style.display = "none";
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

function doAnimations() {
  const animationSpeed = 0.002;
  // 'floating' animation
  if (animationState.shouldFloatAnimation) {
    digitGroup.position.y = Math.sin(Date.now() * animationSpeed);
  }
  // 'zoom' animation
  if (animationState.shouldZoomAnimation) {
    digitGroup.position.z = Math.sin(Date.now() * animationSpeed);
  }
}

function animate() {
  requestAnimationFrame(animate);

  const rotationSpeed = 0.005;
  if (animationState.shouldRotate) {
    lastRotationY += rotationSpeed;
    digitGroup.rotation.y = lastRotationY;
  }

  if (
    animationState.shouldFloatAnimation ||
    animationState.shouldZoomAnimation
  ) {
    doAnimations();
  }

  renderer.render(scene, camera);
}

function updateDisplay(
  timeString,
  areColonsVisible = true /* should the colon be visible on this invocation*/
) {
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
  const scaleFactor = targetWidth / totalDisplayWidth;

  // Now that we have the scale, calculate the starting x-position
  // This will ensure equal distance from both edges
  const scaledDisplayWidth = totalDisplayWidth * scaleFactor;
  let xOffset = -scaledDisplayWidth / 2;

  // Set the scale of the entire digit group
  digitGroup.scale.set(scaleFactor, scaleFactor, scaleFactor);

  // Position digits with proper spacing
  chars.forEach((char, _) => {
    let child;

    if (char === ":") {
      // Create the colon at its own origin (0,0)
      child = createColon(0, areColonsVisible);

      // Set the position of the entire colon group
      child.position.x = xOffset / scaleFactor + COLON_WIDTH / 2;
      xOffset += COLON_WIDTH * scaleFactor;
    } else {
      // Create the digit at its own origin (0,0)
      child = createDigit(char, 0);

      // Set the position of the entire digit group
      child.position.x = xOffset / scaleFactor + DIGIT_WIDTH / 2;
      xOffset += DIGIT_WIDTH * scaleFactor;
    }

    digitGroup.add(child);
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
    animationState.shouldRotate = !animationState.shouldRotate;
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
