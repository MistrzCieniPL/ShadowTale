const canvas = document.createElement("canvas");
document.body.prepend(canvas);

const ctx = canvas.getContext("2d");

let stars = [];
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

for (let i = 0; i < 180; i++) {
    stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.4 + 0.1
    });
}

document.addEventListener("mousemove", (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
});

document.addEventListener("touchmove", (event) => {
    if (event.touches.length > 0) {
        mouseX = event.touches[0].clientX;
        mouseY = event.touches[0].clientY;
    }
});

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const star of stars) {

        const distanceX = mouseX - star.x;
        const distanceY = mouseY - star.y;

        star.x += distanceX * 0.00015;
        star.y += distanceY * 0.00015;

        star.y += star.speed;

        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }

        ctx.beginPath();
        ctx.arc(
            star.x,
            star.y,
            star.size,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "white";
        ctx.fill();
    }

    requestAnimationFrame(animate);
}

animate();
