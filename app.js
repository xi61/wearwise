document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("getOutfitBtn");
    const resultDiv = document.getElementById("result");
    const coldSlider = document.getElementById("coldSensitivity");
    const coldValue = document.getElementById("coldValue");
    const sickCheckbox = document.getElementById("getsSickEasily");
    const durationSelect = document.getElementById("outdoorDuration");
    const goHomeInput = document.getElementById("goHomeTime");
  
    if (!button || !resultDiv) {
      console.error("Critical elements missing");
      return;
    }
  
    if (coldSlider && coldValue) {
      coldSlider.addEventListener("input", () => {
        coldValue.textContent = coldSlider.value;
      });
    }
  
    button.addEventListener("click", () => {
      resultDiv.style.display = "block";
      resultDiv.textContent = "📍 Getting your location...";
  
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
  
            resultDiv.textContent = "🌤️ Fetching weather...";
  
            const weather = await fetchWeather(lat, lon);
  
            const preferences = {
              coldSensitivity: Number(coldSlider?.value ?? 1),
              getsSickEasily: sickCheckbox?.checked ?? false,
              duration: durationSelect?.value ?? "short"
            };
  
            const durationHours = estimateDurationHours(goHomeInput?.value);
  
            const rec = recommendOutfit(
              weather,
              preferences,
              { lat, lon, durationHours }
            );
  
            resultDiv.innerHTML = `
              <strong>🌤️ Weather</strong><br/>
              Feels like: ${weather.feelsLike}°C (${describeWeather(weather.feelsLike, weather.windSpeed)})<br/>
              Wind: ${weather.windSpeed} km/h<br/>
              ${goHomeInput?.value ? `Going home around ${goHomeInput.value}<br/>` : ""}
              <br/>
  
              <strong>👕 Outfit</strong><br/>
              Top: ${rec.outfit.top}<br/>
              Insulation: ${rec.outfit.insulation ?? "none"}<br/>
              Outer layer: ${rec.outfit.outer ?? "none"}<br/>
              Bottoms: ${rec.outfit.bottoms}<br/>
              Accessories: ${rec.outfit.accessories.length ? rec.outfit.accessories.join(", ") : "none"}<br/><br/>
  
              <em>${rec.note}</em>
            `;
          } catch (err) {
            console.error(err);
            resultDiv.textContent = "❌ Failed to load weather.";
          }
        },
        () => {
          resultDiv.textContent = "❌ Location permission denied.";
        }
      );
    });
  });
  
  /* ---------------- WEATHER ---------------- */
  
  async function fetchWeather(lat, lon) {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}` +
      `&longitude=${lon}` +
      `&current=apparent_temperature,wind_speed_10m` +
      `&hourly=apparent_temperature`;
  
    const res = await fetch(url);
    if (!res.ok) throw new Error("Weather API failed");
  
    const data = await res.json();
  
    return {
      feelsLike: data.current.apparent_temperature,
      windSpeed: data.current.wind_speed_10m,
      hourlyFeelsLike: data.hourly.apparent_temperature.slice(0, 6)
    };
  }
  
  /* ---------------- OUTFIT ENGINE ---------------- */
  
  function recommendOutfit(weather, preferences, context = {}) {
    let notes = [];
  
    let effectiveFeelsLike = weather.feelsLike;
    if (weather.windSpeed > 12) effectiveFeelsLike -= 5;
    effectiveFeelsLike -= preferences.coldSensitivity * 4;
  
    const outfit = {
      top: "",
      insulation: null,
      outer: null,
      bottoms: "",
      accessories: []
    };
  
    // Base outfit
    if (effectiveFeelsLike >= 75) {
      outfit.top = "tank or tee";
      outfit.bottoms = "shorts";
    } else if (effectiveFeelsLike >= 60) {
      outfit.top = "tee or long sleeve";
      outfit.bottoms = "pants";
    } else {
      outfit.top = "long sleeve";
      outfit.bottoms = "pants";
    }
  
    if (effectiveFeelsLike < 60) outfit.insulation = "sweater or hoodie";
    if (effectiveFeelsLike < 50) outfit.insulation = "fleece";
  
    // Coastal rule
    if (context.lat && context.lon && isLikelyCoastal(context.lat, context.lon)) {
      effectiveFeelsLike -= 3;
      if (weather.windSpeed > 8) {
        outfit.outer ??= "windbreaker";
        notes.push("Coastal winds can make sunny days feel colder.");
      }
    }
  
    if (!outfit.outer && weather.windSpeed > 10) {
      outfit.outer = "windbreaker";
    } else if (effectiveFeelsLike < 45) {
      outfit.outer = "jacket or coat";
    }
  
    // Later cooling
    const minLater = Math.min(...weather.hourlyFeelsLike);
    if (minLater < weather.feelsLike - 5) {
      outfit.accessories.push("extra layer");
      notes.push(`It will feel about ${Math.round(weather.feelsLike - minLater)}° colder later.`);
    }
  
    // Health sensitivity
    if (preferences.getsSickEasily && effectiveFeelsLike < 60) {
      outfit.accessories.push("scarf");
      notes.push("Extra warmth recommended since you get sick easily.");
    }
  
    // Duration-based advice
    if (context.durationHours != null) {
      if (context.durationHours >= 8) {
        outfit.accessories.push("light removable layer");
        notes.push("You’ll be out most of the day — wear layers you can remove.");
      } else if (context.durationHours >= 4) {
        notes.push("You’ll be outside for several hours — expect mild changes.");
      }
    }
  
    const trend = describeDayTrend(weather.hourlyFeelsLike);
    if (trend) notes.push(trend);
  
    return { outfit, note: notes.join(" ") };
  }
  
  /* ---------------- HELPERS ---------------- */
  
  function describeWeather(feelsLike, windSpeed) {
    const temp =
      feelsLike >= 25 ? "hot" :
      feelsLike >= 18 ? "mild" :
      feelsLike >= 12 ? "cool" :
      feelsLike >= 5 ? "cold" : "freezing";
  
    const wind =
      windSpeed < 5 ? "calm air" :
      windSpeed < 12 ? "gentle breeze" :
      windSpeed < 20 ? "chilly wind" : "strong, biting wind";
  
    return `${temp}, ${wind}`;
  }
  
  function isLikelyCoastal(lat, lon) {
    return lon < -120 && lon > -130 && lat > 32 && lat < 42;
  }
  
  function describeDayTrend(h) {
    if (!h || h.length < 6) return "";
    if (h[3] - h[0] >= 5 && h[5] < h[3] - 4) return "Cool morning → warmer midday → cooler evening.";
    if (h[3] - h[0] >= 5) return "Cool morning → warmer midday.";
    if (h[5] < h[3] - 4) return "Temperatures drop noticeably in the evening.";
    return "Fairly steady temperatures throughout the day.";
  }
  
  function estimateDurationHours(goHomeTime) {
    if (!goHomeTime) return null;
    const now = new Date();
    const [h, m] = goHomeTime.split(":").map(Number);
    const end = new Date();
    end.setHours(h, m, 0, 0);
    if (end < now) end.setDate(end.getDate() + 1);
    return Math.round((end - now) / (1000 * 60 * 60));
  }
  document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("getOutfitBtn");
    const resultDiv = document.getElementById("result");
    const coldSlider = document.getElementById("coldSensitivity");
    const coldValue = document.getElementById("coldValue");
    const sickCheckbox = document.getElementById("getsSickEasily");
    const durationSelect = document.getElementById("outdoorDuration");
    const goHomeInput = document.getElementById("goHomeTime");
  
    if (!button || !resultDiv) {
      console.error("Critical elements missing");
      return;
    }
  
    if (coldSlider && coldValue) {
      coldSlider.addEventListener("input", () => {
        coldValue.textContent = coldSlider.value;
      });
    }
  
    button.addEventListener("click", () => {
      resultDiv.style.display = "block";
      resultDiv.textContent = "📍 Getting your location...";
  
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
  
            resultDiv.textContent = "🌤️ Fetching weather...";
  
            const weather = await fetchWeather(lat, lon);
  
            const preferences = {
              coldSensitivity: Number(coldSlider?.value ?? 1),
              getsSickEasily: sickCheckbox?.checked ?? false,
              duration: durationSelect?.value ?? "short"
            };
  
            const durationHours = estimateDurationHours(goHomeInput?.value);
  
            const rec = recommendOutfit(
              weather,
              preferences,
              { lat, lon, durationHours }
            );
  
            resultDiv.innerHTML = `
              <strong>🌤️ Weather</strong><br/>
              Feels like: ${weather.feelsLike}°C (${describeWeather(weather.feelsLike, weather.windSpeed)})<br/>
              Wind: ${weather.windSpeed} km/h<br/>
              ${goHomeInput?.value ? `Going home around ${goHomeInput.value}<br/>` : ""}
              <br/>
  
              <strong>👕 Outfit</strong><br/>
              Top: ${rec.outfit.top}<br/>
              Insulation: ${rec.outfit.insulation ?? "none"}<br/>
              Outer layer: ${rec.outfit.outer ?? "none"}<br/>
              Bottoms: ${rec.outfit.bottoms}<br/>
              Accessories: ${rec.outfit.accessories.length ? rec.outfit.accessories.join(", ") : "none"}<br/><br/>
  
              <em>${rec.note}</em>
            `;
          } catch (err) {
            console.error(err);
            resultDiv.textContent = "❌ Failed to load weather.";
          }
        },
        () => {
          resultDiv.textContent = "❌ Location permission denied.";
        }
      );
    });
  });
  
  /* ---------------- WEATHER ---------------- */
  
  async function fetchWeather(lat, lon) {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}` +
      `&longitude=${lon}` +
      `&current=apparent_temperature,wind_speed_10m` +
      `&hourly=apparent_temperature`;
  
    const res = await fetch(url);
    if (!res.ok) throw new Error("Weather API failed");
  
    const data = await res.json();
  
    return {
      feelsLike: data.current.apparent_temperature,
      windSpeed: data.current.wind_speed_10m,
      hourlyFeelsLike: data.hourly.apparent_temperature.slice(0, 6)
    };
  }
  
  /* ---------------- OUTFIT ENGINE ---------------- */
  
  function recommendOutfit(weather, preferences, context = {}) {
    let notes = [];
  
    let effectiveFeelsLike = weather.feelsLike;
    if (weather.windSpeed > 12) effectiveFeelsLike -= 5;
    effectiveFeelsLike -= preferences.coldSensitivity * 4;
  
    const outfit = {
      top: "",
      insulation: null,
      outer: null,
      bottoms: "",
      accessories: []
    };
  
    // Base outfit
    if (effectiveFeelsLike >= 75) {
      outfit.top = "tank or tee";
      outfit.bottoms = "shorts";
    } else if (effectiveFeelsLike >= 60) {
      outfit.top = "tee or long sleeve";
      outfit.bottoms = "pants";
    } else {
      outfit.top = "long sleeve";
      outfit.bottoms = "pants";
    }
  
    if (effectiveFeelsLike < 60) outfit.insulation = "sweater or hoodie";
    if (effectiveFeelsLike < 50) outfit.insulation = "fleece";
  
    // Coastal rule
    if (context.lat && context.lon && isLikelyCoastal(context.lat, context.lon)) {
      effectiveFeelsLike -= 3;
      if (weather.windSpeed > 8) {
        outfit.outer ??= "windbreaker";
        notes.push("Coastal winds can make sunny days feel colder.");
      }
    }
  
    if (!outfit.outer && weather.windSpeed > 10) {
      outfit.outer = "windbreaker";
    } else if (effectiveFeelsLike < 45) {
      outfit.outer = "jacket or coat";
    }
  
    // Later cooling
    const minLater = Math.min(...weather.hourlyFeelsLike);
    if (minLater < weather.feelsLike - 5) {
      outfit.accessories.push("extra layer");
      notes.push(`It will feel about ${Math.round(weather.feelsLike - minLater)}° colder later.`);
    }
  
    // Health sensitivity
    if (preferences.getsSickEasily && effectiveFeelsLike < 60) {
      outfit.accessories.push("scarf");
      notes.push("Extra warmth recommended since you get sick easily.");
    }
  
    // Duration-based advice
    if (context.durationHours != null) {
      if (context.durationHours >= 8) {
        outfit.accessories.push("light removable layer");
        notes.push("You’ll be out most of the day — wear layers you can remove.");
      } else if (context.durationHours >= 4) {
        notes.push("You’ll be outside for several hours — expect mild changes.");
      }
    }
  
    const trend = describeDayTrend(weather.hourlyFeelsLike);
    if (trend) notes.push(trend);
  
    return { outfit, note: notes.join(" ") };
  }
  
  /* ---------------- HELPERS ---------------- */
  
  function describeWeather(feelsLike, windSpeed) {
    const temp =
      feelsLike >= 25 ? "hot" :
      feelsLike >= 18 ? "mild" :
      feelsLike >= 12 ? "cool" :
      feelsLike >= 5 ? "cold" : "freezing";
  
    const wind =
      windSpeed < 5 ? "calm air" :
      windSpeed < 12 ? "gentle breeze" :
      windSpeed < 20 ? "chilly wind" : "strong, biting wind";
  
    return `${temp}, ${wind}`;
  }
  
  function isLikelyCoastal(lat, lon) {
    return lon < -120 && lon > -130 && lat > 32 && lat < 42;
  }
  
  function describeDayTrend(h) {
    if (!h || h.length < 6) return "";
    if (h[3] - h[0] >= 5 && h[5] < h[3] - 4) return "Cool morning → warmer midday → cooler evening.";
    if (h[3] - h[0] >= 5) return "Cool morning → warmer midday.";
    if (h[5] < h[3] - 4) return "Temperatures drop noticeably in the evening.";
    return "Fairly steady temperatures throughout the day.";
  }
  
  function estimateDurationHours(goHomeTime) {
    if (!goHomeTime) return null;
    const now = new Date();
    const [h, m] = goHomeTime.split(":").map(Number);
    const end = new Date();
    end.setHours(h, m, 0, 0);
    if (end < now) end.setDate(end.getDate() + 1);
    return Math.round((end - now) / (1000 * 60 * 60));
  }
  
