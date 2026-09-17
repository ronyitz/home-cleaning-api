const ROOM_TYPES = [
  {
    value: "other",
    label: "כללי",
    defaultTasks: [],
  },
  {
    value: "living_room",
    label: "סלון",
    defaultTasks: [
      { name: "שאיבת אבק", frequency: 7 },
      { name: "ניגוב אבק", frequency: 7 },
      { name: "ניקוי שטיח", frequency: 30 },
    ],
  },
  {
    value: "kitchen",
    label: "מטבח",
    defaultTasks: [
      { name: "ניקוי משטחים", frequency: 1 },
      { name: "ריקון פח", frequency: 2 },
      { name: "ניקוי תנור", frequency: 30 },
    ],
  },
  {
    value: "office",
    label: "משרד",
    defaultTasks: [
      { name: "ניקוי שולחן", frequency: 3 },
      { name: "שאיבת אבק", frequency: 7 },
    ],
  },
  {
    value: "bedroom",
    label: "חדר שינה",
    defaultTasks: [
      { name: "החלפת מצעים", frequency: 14 },
      { name: "שאיבת אבק", frequency: 7 },
    ],
  },
  {
    value: "car",
    label: "רכב",
    defaultTasks: [
      { name: "שטיפה חיצונית", frequency: 14 },
      { name: "שטיפה פנימית", frequency: 30 },
    ],
  },
  {
    value: "yard",
    label: "חצר",
    defaultTasks: [],
  },
  {
    value: "bathroom",
    label: "חדר אמבטיה",
    defaultTasks: [
      { name: "ניקוי אסלה", frequency: 3 },
      { name: "ניקוי כיור", frequency: 3 },
      { name: "ניקוי מקלחת/אמבטיה", frequency: 7 },
      { name: "שטיפת רצפה", frequency: 7 },
    ],
  },
];

module.exports = ROOM_TYPES;
