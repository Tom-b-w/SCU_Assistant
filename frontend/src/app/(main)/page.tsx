export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
      <p className="text-gray-500">
        Welcome to SCU Assistant. Your personalized campus companion.
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Placeholder cards for future modules */}
        {["Today's Schedule", "Upcoming Deadlines", "Canteen Status", "Next Bus"].map(
          (title) => (
            <div
              key={title}
              className="rounded-lg border bg-white p-6 shadow-sm dark:bg-gray-950"
            >
              <h3 className="text-sm font-medium text-gray-500">{title}</h3>
              <p className="mt-2 text-2xl font-bold">--</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
