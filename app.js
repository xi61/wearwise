
// document.addEventListener("DOMContentLoaded", () => {
//     const button = document.getElementById("getOutfitBtn");
//     const resultDiv = document.getElementById("result");
  
//     const coldSlider = document.getElementById("coldSensitivity");
//     const coldValue = document.getElementById("coldValue");
//     const sickCheckbox = document.getElementById("getsSickEasily");
//     const durationSelect = document.getElementById("outdoorDuration");
//     const goHomeInput = document.getElementById("goHomeTime");
  
//     // Safety check
//     if (!button || !resultDiv) {
//       console.error("Required elements not found in HTML");
//       return;
//     }
  
//     // Update slider label live
//     if (coldSlider && coldValue) {
//       coldSlider.addEventListener("input", () => {
//         coldValue.textContent = coldSlider.value;
//       });
//     }
  
//     button.addEventListener("click", () => {
//       resultDiv.style.display = "block";
//       resultDiv.innerHTML = "📍 Getting your location...";
  
//       if (!navigator.geolocation) {
//         resultDiv.innerHTML = "❌ Geolocation not supported in this browser.";
//         return;
//       }
  
//       navigator.geolocation.getCurrentPosition(
//         async (position) => {
//           try {
//             const lat = position.coords.latitude;
//             const lon = position.coords.longitude;
  
//             resultDiv.innerHTML = "🌤️ Fetching weather...";
  
//             const weather = await fetchWeather(lat, lon);
  
//             // Read preferences at click time
//             const preferences = {
//               coldSensitivity: Number(coldSlider?.value ?? 1),
//               getsSickEasily: sickCheckbox?.checked ?? false,
//               duration: durationSelect?.value ?? "short",
//             };
  
//             const durationHours = estimateDurationHours(goHomeInput?.value ?? "");
  
//             const rec = recommendOutfit(weather, preferences, { lat, lon, durationHours });
  
//             resultDiv.innerHTML = `
//               <strong>🌤️ Weather</strong><br/>
//               Feels like: ${weather.feelsLike.toFixed(1)}°C
//               (${describeWeather(weather.feelsLike, weather.windSpeed)})<br/>
//               Wind: ${weather.windSpeed.toFixed(1)} km/h<br/><br/>
  
//               <strong>👕 Outfit</strong><br/>
//               Top: ${rec.outfit.top}<br/>
//               Insulation: ${rec.outfit.insulation ?? "none"}<br/>
//               Outer layer: ${rec.outfit.outer ?? "none"}<br/>
//               Bottoms: ${rec.outfit.bottoms}<br/>
//               Accessories: ${
//                 rec.outfit.accessories.length
//                   ? rec.outfit.accessories.join(", ")
//                   : "none"
//               }<br/><br/>
  
//               <em>${rec.note}</em>
//             `;
//           } catch (err) {
//             console.error(err);
//             resultDiv.innerHTML = "❌ Failed to load weather. (Check Console for details)";
//           }
//         },
//         (err) => {
//           console.error("Geolocation error:", err);
//           resultDiv.innerHTML = "❌ Could not get your location.";
//         },
//         { enableHighAccuracy: true, timeout: 15000 }
//       );
//     });
//   });
  
//   // ---------------- WEATHER ----------------
  
//   async function fetchWeather(lat, lon) {
//     // timezone=auto makes hourly align with user's local time
//     const url =
//       `https://api.open-meteo.com/v1/forecast` +
//       `?latitude=${lat}` +
//       `&longitude=${lon}` +
//       `&current=temperature_2m,apparent_temperature,wind_speed_10m` +
//       `&hourly=apparent_temperature` +
//       `&forecast_days=1` +
//       `&timezone=auto`;
  
//     const response = await fetch(url);
//     if (!response.ok) throw new Error("Weather API failed");
  
//     const data = await response.json();
  
//     // Use next 12 hours for more meaningful “day trend”
//     const hourly = data.hourly?.apparent_temperature ?? [];
//     const hourlyFeelsLike = hourly.slice(0, 12);
  
//     return {
//       temperature: data.current.temperature_2m,
//       feelsLike: data.current.apparent_temperature,
//       windSpeed: data.current.wind_speed_10m,
//       hourlyFeelsLike,
//     };
//   }
  
//   // ---------------- OUTFIT ENGINE ----------------
  
//   function recommendOutfit(weather, preferences, context) {
//     let noteParts = [];
  
//     // Effective feels-like
//     let effectiveFeelsLike = weather.feelsLike;
  
//     if (weather.windSpeed > 12) effectiveFeelsLike -= 5;
//     effectiveFeelsLike -= preferences.coldSensitivity * 4;
  
//     const outfit = {
//       top: null,
//       insulation: null,
//       outer: null,
//       bottoms: null,
//       accessories: [],
//     };
  
//     // Top + bottoms
//     if (effectiveFeelsLike >= 24) {           // ~75°F
//       outfit.top = "tank or tee";
//       outfit.bottoms = "shorts";
//     } else if (effectiveFeelsLike >= 16) {    // ~60°F
//       outfit.top = "tee or long sleeve";
//       outfit.bottoms = "pants";
//     } else {
//       outfit.top = "long sleeve";
//       outfit.bottoms = "pants";
//     }
  
//     // Insulation
//     if (effectiveFeelsLike < 16) outfit.insulation = "sweater or hoodie";
//     if (effectiveFeelsLike < 10) outfit.insulation = "fleece";
  
//     // ✅ Coastal rule (FIXED: use context, not undefined 'location')
//     if (context?.lat != null && context?.lon != null && isLikelyCoastal(context.lat, context.lon)) {
//       effectiveFeelsLike -= 3;
//       if (weather.windSpeed > 8) {
//         noteParts.push("Coastal winds can make sunny days feel colder.");
//         outfit.outer = outfit.outer ?? "windbreaker";
//       }
//     }
  
//     // Outer layer (wind overrides)
//     if (weather.windSpeed > 10) {
//       outfit.outer = "windbreaker";
//       noteParts.push("Windy conditions — a windbreaker helps a lot.");
//     } else if (effectiveFeelsLike < 7) {
//       outfit.outer = "jacket or coat";
//     }
  
//     // Hourly trend
//     const dayTrend = describeDayTrend(weather.hourlyFeelsLike);
//     if (dayTrend) noteParts.push(dayTrend);
  
//     // Later temperature drop
//     if (weather.hourlyFeelsLike?.length) {
//       const minLater = Math.min(...weather.hourlyFeelsLike);
//       if (minLater < weather.feelsLike - 4) {
//         outfit.accessories.push("extra layer");
//         noteParts.push(`Later may feel ~${Math.round(weather.feelsLike - minLater)}°C colder — bring a layer.`);
//       }
//     }
  
//     // Health sensitivity
//     if (preferences.getsSickEasily && effectiveFeelsLike < 16) {
//       outfit.accessories.push("scarf");
//       noteParts.push("Since you get sick easily, keep your neck warm.");
//     }
  
//     // Duration-based layering
//     if (preferences.duration === "long") {
//       outfit.accessories.push("light removable layer");
//       noteParts.push("You’ll be out most of the day — wear layers you can take off at noon.");
//     }
  
//     // Go-home-time based durationHours
//     if (context?.durationHours != null) {
//       const h = context.durationHours;
//       if (h >= 8) {
//         outfit.accessories.push("light removable layer");
//         noteParts.push(`You’ll be out ~${h} hours — layers are your best friend.`);
//       } else if (h >= 4) {
//         noteParts.push(`You’ll be out ~${h} hours — plan for small temperature changes.`);
//       }
//     }
  
//     const note = noteParts.length ? noteParts.join(" ") : "Have a great day!";
//     return { outfit, note };
//   }
  
//   // ---------------- HELPERS ----------------
  
//   function describeWeather(feelsLike, windSpeed) {
//     let tempDesc = "";
//     let windDesc = "";
  
//     if (feelsLike >= 25) tempDesc = "hot";
//     else if (feelsLike >= 18) tempDesc = "mild";
//     else if (feelsLike >= 12) tempDesc = "cool";
//     else if (feelsLike >= 5) tempDesc = "cold";
//     else tempDesc = "freezing";
  
//     if (windSpeed < 5) windDesc = "calm air";
//     else if (windSpeed < 12) windDesc = "gentle breeze";
//     else if (windSpeed < 20) windDesc = "chilly wind";
//     else windDesc = "strong, biting wind";
  
//     return `${tempDesc}, ${windDesc}`;
//   }
  
//   function isLikelyCoastal(lat, lon) {
//     // rough CA-coast-ish heuristic
//     return lon < -120 && lon > -130 && lat > 32 && lat < 42;
//   }
  
//   function describeDayTrend(hourlyFeelsLike) {
//     if (!hourlyFeelsLike || hourlyFeelsLike.length < 6) return "";
  
//     const morning = hourlyFeelsLike[0];
//     const noon = hourlyFeelsLike[Math.floor(hourlyFeelsLike.length / 2)];
//     const evening = hourlyFeelsLike[hourlyFeelsLike.length - 1];
  
//     let s = "Today’s trend: ";
  
//     if (noon - morning >= 3) s += "cooler now → warmer around midday → ";
//     else s += "fairly steady through the day → ";
  
//     if (evening < noon - 3) s += "cooler again in the evening.";
//     else s += "stays mild into the evening.";
  
//     return s;
//   }
  
//   function estimateDurationHours(goHomeTime) {
//     if (!goHomeTime) return null;
  
//     const now = new Date();
//     const parts = goHomeTime.split(":").map(Number);
//     if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
  
//     const [hour, minute] = parts;
  
//     const end = new Date();
//     end.setHours(hour, minute, 0, 0);
  
//     if (end < now) end.setDate(end.getDate() + 1);
  
//     const diffMs = end - now;
//     return Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
//   }
  

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
  