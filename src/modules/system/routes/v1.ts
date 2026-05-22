import { Router, Request, Response } from 'express'

const router = Router()

// Update this whenever a new version is released to stores
const LATEST_VERSION = {
  version: '1.0.0',
  force_update: false,
  store_urls: {
    ios: 'https://apps.apple.com/app/twedot',
    android: 'https://play.google.com/store/apps/details?id=com.twedot.app',
  },
}

// Editable server-side — update without shipping a new app build
const SERVICES: string[] = [
  // Tech
  'Software Developer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
  'Mobile App Developer', 'UI/UX Designer', 'Product Designer', 'Product Manager',
  'Project Manager', 'Data Analyst', 'Data Scientist', 'Machine Learning Engineer',
  'AI Engineer', 'DevOps Engineer', 'Cloud Engineer', 'Cybersecurity Specialist',
  'IT Support Specialist', 'Systems Administrator', 'Database Administrator',
  'Blockchain Developer', 'Game Developer', 'QA Engineer', 'Scrum Master', 'Technical Writer',
  // Creative & Media
  'Graphic Designer', 'Brand Designer', 'Motion Designer', 'Video Editor', 'Photographer',
  'Videographer', 'Content Creator', 'Social Media Manager', 'Copywriter', 'Blogger',
  'Podcaster', 'Illustrator', 'Animator', '3D Artist', 'Music Producer', 'DJ',
  'Sound Engineer', 'Voice Artist', 'Actor',
  // Business & Finance
  'Entrepreneur', 'Business Owner', 'Digital Marketer', 'SEO Specialist', 'Sales Executive',
  'Business Analyst', 'Financial Analyst', 'Accountant', 'Auditor', 'Tax Consultant',
  'Investment Banker', 'Stockbroker', 'Insurance Agent', 'Loan Officer', 'Economist',
  'Supply Chain Manager', 'Logistics Coordinator', 'Procurement Officer',
  'E-commerce Seller', 'Import / Export Trader',
  // Professional Services
  'Lawyer', 'Legal Consultant', 'Doctor', 'Pharmacist', 'Nurse', 'Physiotherapist',
  'Dentist', 'Optician', 'Psychologist', 'Nutritionist', 'Architect', 'Civil Engineer',
  'Structural Engineer', 'Electrical Engineer', 'Mechanical Engineer', 'Surveyor',
  'Estate Agent', 'Property Developer', 'HR Manager', 'Recruitment Consultant',
  // Trades & On-Site Services
  'Electrician', 'Plumber', 'Carpenter', 'Welder', 'Painter', 'Tiler',
  'Mason / Bricklayer', 'HVAC Technician', 'Appliance Repair Technician',
  'Generator Technician', 'Phone Repair Technician', 'Auto Mechanic', 'Auto Electrician',
  'Panel Beater / Body Shop', 'Vulcanizer', 'Dispatch Rider', 'Pickup / Delivery Service',
  'Truck / Haulage Driver', 'Taxi / Ride-share Driver', 'Moving Service',
  // Beauty, Wellness & Lifestyle
  'Hairdresser', 'Barber', 'Makeup Artist', 'Nail Technician', 'Skincare Specialist',
  'Spa Therapist', 'Fitness Trainer', 'Yoga Instructor', 'Chef', 'Caterer', 'Baker',
  'Event Planner', 'Wedding Planner', 'Interior Designer', 'Fashion Designer', 'Tailor',
  // Education & Community
  'Teacher', 'Tutor', 'University Lecturer', 'Student', 'Researcher', 'Consultant',
  'Coach / Mentor', 'Customer Support', 'Community Manager', 'NGO / Non-profit Worker',
]

router.get('/version', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Version info',
    data: LATEST_VERSION,
  })
})

router.get('/services', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Services list',
    data: SERVICES,
  })
})

export const systemRouterV1 = router
