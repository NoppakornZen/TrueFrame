# Quick Test Guide

## ✅ Testing the TrueFrame Demo

### 1. Load the Application
- Open http://localhost:3001/
- Should see TrueFrame header with shield icon
- Boeing 737 case should be visible

### 2. Test Evidence Upload
**Photo Upload:**
- Click "Upload Photo" button
- Select any image file
- Wait 1.5 seconds for AI analysis
- Should see evidence card appear with:
  - Camera icon
  - File name
  - AI Analysis section with confidence %
  - Green checkmark (Accept recommendation)
  - 5 findings about part condition

**Barcode Upload:**
- Click "Scan Barcode" button
- Select any image file
- Should see evidence card with:
  - Barcode scanner icon
  - Serial number: SN-787-45892-A
  - Barcode format: CODE128
  - 98% confidence

**Document Upload:**
- Click "Upload Document" button
- Select any file (image or PDF)
- Should see evidence card with:
  - Document icon
  - Certificate details
  - FAA certificate number
  - 96% confidence

### 3. Test Decision Analysis
**Run Analysis:**
- Upload at least 2-3 pieces of evidence
- Click "Run Analysis" button in Decision Panel (right column)
- Should see:
  - Decision badge (ACCEPT/REJECT/NEEDS REVIEW)
  - Confidence percentage with color-coded bar
  - Statistics: Evidence Used, Conflicts Detected, Policies Checked
  - Decision Reasoning list with checkmarks
  - Next Best Evidence recommendation card

**Expected Results:**
- With 3+ evidence: Should get "ACCEPT" with 90%+ confidence
- With 1-2 evidence: Might get "NEEDS_REVIEW" 
- Reasoning should list specific findings

### 4. Test Evidence Graph
**View Visualization:**
- Scroll down to "Evidence Decision Graph" section
- Should see interactive flow diagram:
  - Evidence nodes at top (blue/green)
  - Policy nodes in middle (cyan)
  - Decision node at bottom (green for accept)
  - Animated edges connecting them
- Try zooming with mouse wheel
- Try panning by dragging
- Use minimap in bottom-right to navigate

### 5. Test Policy Dashboard
**View Policies:**
- Scroll to Policy Dashboard (right column, bottom)
- Should see 4 policies listed
- All should have "Active" badge (green)

**Expand Policy:**
- Click on any policy card
- Should show:
  - Required Evidence types as badges
  - Confidence threshold bar with percentage
  - Conditions in code format
  - Edit and Delete buttons

**Toggle Policy:**
- Click power icon on any policy
- Policy should become grayed out
- Badge changes to "Disabled"
- Click again to re-enable

**Statistics:**
- Bottom of dashboard shows:
  - Total Policies: 4
  - Active: (number of enabled)
  - Disabled: (number of disabled)

### 6. Test Evidence Removal
**Delete Evidence:**
- Find any evidence card
- Click trash icon in bottom-right
- Evidence should disappear
- Re-run analysis if needed

### 7. Visual Quality Check
**Design Elements:**
- [ ] Dark aerospace theme (deep blue-black background)
- [ ] Cyan accent color on buttons and icons
- [ ] Smooth hover effects on buttons
- [ ] Pill-shaped buttons and badges
- [ ] Consistent spacing throughout
- [ ] No layout breaks or overlapping text
- [ ] Icons render correctly (lucide-react)

**Responsive Check:**
- Resize browser window
- Layout should adapt at breakpoints
- No horizontal scrolling
- Content should stack on smaller screens

### 8. Browser Compatibility
Test in:
- [ ] Chrome/Edge (primary)
- [ ] Firefox
- [ ] Safari (if available)

### 9. Performance Check
- [ ] Page loads in < 2 seconds
- [ ] Evidence upload animation smooth
- [ ] Graph interactions don't lag
- [ ] No console errors (press F12)

### 10. Common Issues & Fixes

**Issue: Graph not showing**
- Check if React Flow package installed: `npm list @xyflow/react`
- Should show version 12.x

**Issue: Icons not showing**
- Check if lucide-react installed: `npm list lucide-react`
- Refresh browser with Ctrl+Shift+R

**Issue: Styles broken**
- Check if index.css loaded
- Open DevTools → Network tab
- Look for index.css with 200 status

**Issue: Upload not working**
- Check browser console for errors
- Try different file (JPG, PNG)
- Check file size < 10MB

**Issue: Dev server crashed**
- Restart: `npm run dev`
- Check port 3001 is not blocked

---

## 🎯 Expected Demo Flow

**Perfect Demo Scenario (3 minutes):**

1. **Start** → "This is TrueFrame, AI-powered delivery verification"
2. **Show Case** → "Boeing 737 turbine blade worth $50,000"
3. **Upload 3 Evidence** → Photo, Barcode, Document (takes ~5 seconds)
4. **Run Analysis** → Click button, get ACCEPT decision
5. **Explain Result** → "96% confidence, all policies satisfied"
6. **Show Graph** → "Visual evidence flow"
7. **Toggle Policy** → "Flexible policy configuration"
8. **Conclusion** → "10x faster, 95% accurate, complete audit trail"

---

## ✅ Success Checklist

Before showing to anyone:

- [ ] Dev server running on port 3001
- [ ] Page loads without errors
- [ ] Can upload 3 types of evidence
- [ ] AI analysis appears with confidence scores
- [ ] Run Analysis produces decision
- [ ] Graph visualizes correctly
- [ ] Policies can be toggled
- [ ] Design looks professional
- [ ] No console errors
- [ ] Tested in Chrome/Edge

**If all checked → Ready to demo! 🚀**
