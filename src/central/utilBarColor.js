export function utilBarColor(percent) {
  if (percent > 90) {
    return "bg-red-500";
  } else if (percent > 70) {
    return "bg-amber-500";
  } else {
    return "bg-indigo-500";
  }
}