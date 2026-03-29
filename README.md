# OpenRad - AI Radiology Report Generator

OpenRad is a modern, responsive web application designed for radiologists and medical professionals to generate, review, and manage AI-assisted radiology reports. It connects a sleek frontend interface with your choice of AI workflow platforms (like n8n) and uses Supabase for cloud data persistence, alongside local caching for blazing-fast performance.
## 📸 OpenRad UI

<img width="1920" height="848" alt="view-summary" src="https://github.com/omersx/assets/9eb9f1ca-fe2f-4bff-90ff-20f8026e9c02" />





<img width="1920" height="854" alt="reports" src="https://github.com/omersx/assets/ad066ccf-a530-47bf-8f15-80cbf91e3aa0" />





## 🚀 Features

- **AI-Powered Report Generation**: Upload a medical image (X-Ray, CT, MRI, Ultrasound), input patient details, and receive an AI-drafted standard medical report.
- **Hybrid Storage Model**:
  - **Cloud Sync**: Securely sync and manage reports via a Supabase PostgreSQL database. (Note: heavy DICOM images are automatically stripped before cloud upload to save space and bandwidth).
  - **Local First**: Lightning-fast offline viewing, persistent storage, and full DICOM image caching using a deep-integrated local **SQLite** database (powered by Drizzle ORM).
- **Customizable Appearance**: Native Dark and Light modes using modern Tailwind CSS v4 variables with dynamic theme switching that avoids UI flashing.
- **Report Templates**: Multiple structured report template styles (Standard, Modern, Minimal).
- **PDF Export**: Generate perfectly formatted medical PDF reports seamlessly.
- **Hospital Branding**: Add custom logos and hospital names directly to all generated exports.
- **User Management & Audit Logs**: Track who reviewed, approved, or rejected reports for medical compliance.

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, React 19)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Database**: Local SQLite (via Drizzle ORM) & [Supabase](https://supabase.com/)
- **State Management**: React Hooks & Context
- **PDF Generation**: `html2pdf.js`
- **Icons**: `lucide-react`

## 🧠 How It Works

1. **Patient & Image Input**: The user uploads a medical image and fills out a clinical context form via the Next.js frontend.
2. **AI Inference**: The app triggers an external webhook (e.g., an n8n automated workflow) and sends the image/patient data. The webhook communicates with an AI model (like Google Gemini or OpenAI) to analyze the image and draft a structured report.
3. **Review & Edit**: The drafted report is returned to the app instantly. A medical professional reviews the findings, edits the content using the built-in rich text editor if necessary, and either Approves or Rejects the draft.
4. **Export & Storage**: Once approved, the report can be exported to a beautifully structured PDF. A full copy (including the image pixel data) is seamlessly saved to the local SQLite database, and if configured, a lightweight text-only copy is synced remotely to the user's Supabase instance.

## 📖 How to Use

1. **Configure Your Settings**: First, navigate to the **Settings** tab. Add your n8n Webhook URL (for the AI backend) and optionally your Supabase credentials for cloud syncing. You can also personalize your hospital branding and toggle dark/light mode here.
   
   so use this OpenRad n8n workflow  :[N8N workflow](https://drive.google.com/file/d/19g1QKiyQ4BaX-QcoRtYEeJP61GGEHqf_/view?usp=sharing)
3. **Generate a Report**: Navigate to the **Dashboard**. Enter the patient's information (Name, Age, Gender), add the "Indication" for the scan, select the correct modality, and upload the image. Click "Generate Report".
4. **Analyze**: Wait a few seconds for the AI to return the draft. Review the detected findings, impression, and recommendations.
5. **Approve/Edit**: Read through the report. If anything needs adjusting, click the **Edit** button to make quick changes textually. Once satisfied, hit **Approve**.
6. **Download**: Click the **Download PDF** button to export the final result securely matching your chosen Template design.

## ⚙️ Getting Started

### Prerequisites

You need Node.js installed on your local machine.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/openrad.git
   cd openrad
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Access the application:**
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🔧 Configuration

All configurations can be done directly from the app's **Settings UI**:
- **n8n Webhook URL**: Insert the endpoint responsible for your medical AI-processing workflow.
- **Supabase Credentials**: Enter your project URL and Anon Key to activate Cloud History and User Management features.
- All configurations entered are securely saved locally to your SQLite database and not tracked by source control.

## 🗄️ Supabase Database Setup (Optional Cloud Sync)

If you want to enable Cloud Sync across devices, you need to configure a Supabase project and create the necessary database table.

1. Go to [Supabase](https://supabase.com/) and create a new project.
2. Navigate to the **SQL Editor** in your Supabase dashboard.
3. **Copy and paste** the following SQL code and click **Run**:

```sql
-- Create the reports table
create table public.reports (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  patient_name text,
  modality text,
  urgency text,
  report_status text default 'Pending',
  report_data jsonb not null
);

-- Enable Row Level Security (RLS)
alter table public.reports enable row level security;

-- Create a policy that allows anyone to insert/select/update
-- (Note: For a production app, you should restrict this to authenticated users)
create policy "Enable all access for all users" on public.reports
for all using (true) with check (true);
```

4. Go to **Project Settings** -> **API** and copy your **Project URL** and **anon public key**.
5. Paste these into the OpenRad **Settings** page in your browser to connect your app!

## 🤝 Contributing

Contributions are heavily encouraged! To contribute:
1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

## 📄 License

This project is released under the **MIT License**.
