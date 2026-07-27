const countdowns = document.querySelectorAll<HTMLElement>("[data-countdown]");

const formatTime = (value: number) => String(value).padStart(2, "0");

countdowns.forEach((countdown) => {
  const targetTime = Date.parse(countdown.dataset.countdownTarget ?? "");
  if (!Number.isFinite(targetTime)) return;

  const days = countdown.querySelector<HTMLElement>("[data-countdown-days]");
  const hours = countdown.querySelector<HTMLElement>("[data-countdown-hours]");
  const minutes = countdown.querySelector<HTMLElement>("[data-countdown-minutes]");
  const seconds = countdown.querySelector<HTMLElement>("[data-countdown-seconds]");

  const renderCountdown = () => {
    const remaining = Math.max(0, targetTime - Date.now());
    const totalSeconds = Math.floor(remaining / 1000);

    if (days) days.textContent = formatTime(Math.floor(totalSeconds / 86_400));
    if (hours) hours.textContent = formatTime(Math.floor((totalSeconds % 86_400) / 3_600));
    if (minutes) minutes.textContent = formatTime(Math.floor((totalSeconds % 3_600) / 60));
    if (seconds) seconds.textContent = formatTime(totalSeconds % 60);

    return remaining > 0;
  };

  renderCountdown();
  const interval = window.setInterval(() => {
    if (!renderCountdown()) window.clearInterval(interval);
  }, 1_000);
});
