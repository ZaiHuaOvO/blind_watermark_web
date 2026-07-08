/**
 * 再花的工具箱 - 动画与交互
 * 花瓣粒子 + AOS 滚动动画
 */

// ======================================================
//  1. AOS 滚动动画初始化
// ======================================================

AOS.init({
  duration: 600,
  easing: 'ease-out-back',
  once: true,
  offset: 60,
});

// ======================================================
//  2. 花瓣粒子系统
// ======================================================

(function createPetals() {
  var container = document.getElementById('petalContainer');
  if (!container) return;
  var colors = ['#ffb5c5', '#ffc8d6', '#ffd6e0', '#ffe0e8', '#ffebf0'];
  var count = 18;

  for (var i = 0; i < count; i++) {
    var petal = document.createElement('div');
    petal.className = 'petal';
    var size = 8 + Math.random() * 14;
    petal.style.width = size + 'px';
    petal.style.height = size * 1.3 + 'px';
    petal.style.left = Math.random() * 100 + '%';
    petal.style.background = colors[Math.floor(Math.random() * colors.length)];
    petal.style.opacity = 0.2 + Math.random() * 0.4;
    petal.style.animationDuration = 8 + Math.random() * 10 + 's';
    petal.style.animationDelay = Math.random() * -12 + 's';
    container.appendChild(petal);
  }
})();

// ======================================================
//  3. 卡片掀角（触屏支持）
// ======================================================

document.querySelectorAll('.tool-card:not(.placeholder)').forEach(function (card) {
  var flap = card.querySelector('.corner-flap');
  var github = card.querySelector('.corner-github');
  if (!flap || !github) return;

  github.addEventListener('click', function (e) {
    e.stopPropagation();
  });

  card.addEventListener('touchstart', function () {
    flap.classList.add('corner-flap--lifted');
  });
  document.addEventListener('touchstart', function (e) {
    if (!card.contains(e.target)) {
      flap.classList.remove('corner-flap--lifted');
    }
  });
});
