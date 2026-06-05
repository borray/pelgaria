using ExamApp.Data;
using System.Windows;

namespace ExamApp
{
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);

            // Ensure SQLite database is created
            using var ctx = new AppDbContext();
            ctx.Database.EnsureCreated();

            QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;
        }
    }
}
