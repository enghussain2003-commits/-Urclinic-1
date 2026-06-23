import React from 'react';
import { Heart, Baby, Bone, Stethoscope, Smile, Sparkles, Activity } from 'lucide-react';

// Unified line-icon set for medical specialties (replaces emoji for a cleaner, professional look).
const ICON_MAP = {
  cardiology: Heart,
  pediatrics: Baby,
  dermatology: Sparkles,
  orthopedics: Bone,
  general: Stethoscope,
  dentistry: Smile,
};

const SpecialtyIcon = ({ id, size = 16, ...rest }) => {
  const Icon = ICON_MAP[id] || Activity;
  return <Icon size={size} {...rest} />;
};

export default SpecialtyIcon;
