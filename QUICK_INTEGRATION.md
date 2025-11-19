# Quick Site Integration Guide

Agar aapko kisi specific site ke saath integrate karna hai, to yeh simple steps follow karein:

## 🚀 Quick Steps

### Step 1: Site Inspect Karo

1. Browser mein site kholo
2. **F12** press karo (DevTools)
3. **Elements** tab mein jao
4. Person/contact element par **right-click** → **Inspect**
5. Selector note karo (class, ID, data attribute)

### Step 2: Selector Find Karo

**Example:**
```html
<div class="user-card" data-user-id="123">
  <span class="user-name">John Doe</span>
</div>
```

**Selectors:**
- Person element: `.user-card` ya `[data-user-id]`
- Name element: `.user-name`

### Step 3: Code Add Karo

`content.js` file mein yeh add karo:

```javascript
// Site-specific integration
if (window.location.hostname.includes('yoursite.com')) {
  const persons = document.querySelectorAll('.user-card'); // Apna selector
  
  persons.forEach(person => {
    if (!person.dataset.recordingButtonAdded) {
      // Button create karo
      const button = document.createElement('button');
      button.className = 'meeting-recorder-btn';
      button.innerHTML = '🎥 Record';
      
      // Position set karo
      person.style.position = 'relative';
      button.style.position = 'absolute';
      button.style.top = '5px';
      button.style.right = '5px';
      
      // Click handler
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        startRecording();
      });
      
      // Button add karo
      person.appendChild(button);
      person.dataset.recordingButtonAdded = 'true';
    }
  });
}
```

### Step 4: Dynamic Content Ke Liye

Agar content dynamically load hota hai:

```javascript
if (window.location.hostname.includes('yoursite.com')) {
  function addButtons() {
    const persons = document.querySelectorAll('.user-card');
    persons.forEach(person => {
      // ... button add logic
    });
  }
  
  // Initial
  addButtons();
  
  // Dynamic content ke liye
  const observer = new MutationObserver(addButtons);
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}
```

## 📝 Complete Example

### Example: Custom Site Integration

```javascript
// content.js mein add karo

// Site detection
const currentSite = window.location.hostname;

// Custom site integration
if (currentSite.includes('yoursite.com')) {
  
  function integrateWithYourSite() {
    // Selectors define karo
    const personSelector = '.user-card, .contact-item';
    const nameSelector = '.user-name, .contact-name';
    
    // Person elements find karo
    const persons = document.querySelectorAll(personSelector);
    
    persons.forEach(person => {
      // Check karo ki button already added hai
      if (person.dataset.recordingButtonAdded === 'true') {
        return;
      }
      
      // Name extract karo
      const nameEl = person.querySelector(nameSelector);
      const personName = nameEl ? nameEl.textContent.trim() : 'Person';
      
      // Button create karo
      const button = document.createElement('button');
      button.className = 'meeting-recorder-btn';
      button.innerHTML = '🎥 Record';
      button.title = `Record meeting with ${personName}`;
      
      // Position set karo
      const computedStyle = window.getComputedStyle(person);
      if (computedStyle.position === 'static') {
        person.style.position = 'relative';
      }
      
      button.style.position = 'absolute';
      button.style.top = '5px';
      button.style.right = '5px';
      button.style.zIndex = '1000';
      
      // Click handler
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        startRecording();
      });
      
      // Button add karo
      person.appendChild(button);
      
      // Mark karo
      person.dataset.recordingButtonAdded = 'true';
    });
  }
  
  // Initial integration
  integrateWithYourSite();
  
  // Dynamic content ke liye observer
  const observer = new MutationObserver(() => {
    integrateWithYourSite();
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
} else {
  // Default behavior (original code)
  injectRecordingButtons();
}
```

## 🎯 Common Sites Ke Liye Examples

### Google Meet
```javascript
if (window.location.hostname.includes('meet.google.com')) {
  const participants = document.querySelectorAll('[data-participant-id]');
  // ... integration logic
}
```

### Zoom
```javascript
if (window.location.hostname.includes('zoom.us')) {
  const participants = document.querySelectorAll('.participant-item');
  // ... integration logic
}
```

### Microsoft Teams
```javascript
if (window.location.hostname.includes('teams.microsoft.com')) {
  const participants = document.querySelectorAll('[data-tid="roster-participant"]');
  // ... integration logic
}
```

## 💡 Tips

1. **Selector Testing:** Console mein test karo:
   ```javascript
   document.querySelectorAll('.your-selector')
   ```

2. **Multiple Selectors:** Agar ek selector kaam nahi karta:
   ```javascript
   const persons = document.querySelectorAll('.selector1, .selector2, [data-attr]');
   ```

3. **Wait for Load:** Agar content late load hota hai:
   ```javascript
   setTimeout(() => {
     integrateWithYourSite();
   }, 2000);
   ```

4. **Debugging:** Console logs add karo:
   ```javascript
   console.log('Found persons:', persons.length);
   ```

## 🔧 Troubleshooting

**Buttons nahi dikh rahe:**
- Selector sahi hai? Console mein check karo
- Element load hua hai? Wait karo
- CSS hide to nahi kar raha? Inspect karo

**Button click nahi ho raha:**
- `e.stopPropagation()` add kiya hai?
- Z-index sahi hai?
- Element par click handler to nahi override ho raha?

**Dynamic content par kaam nahi kar raha:**
- MutationObserver add kiya hai?
- Observer sahi container observe kar raha hai?

---

**Note:** Agar kisi specific site ke liye help chahiye, to site ka URL aur element structure share karo, main exact code de dunga!

