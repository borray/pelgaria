using ExamApp.Data;
using ExamApp.Models;
using System.Windows;

namespace ExamApp.Dialogs
{
    public partial class EditExamDialog : Window
    {
        public Exam Exam { get; private set; } = null!;
        private bool _isEdit;

        public EditExamDialog(Exam? existing = null)
        {
            InitializeComponent();
            if (existing != null)
            {
                _isEdit = true;
                Exam = new Exam
                {
                    Id = existing.Id,
                    Title = existing.Title,
                    Description = existing.Description,
                    DurationMinutes = existing.DurationMinutes,
                    CreatedAt = existing.CreatedAt
                };
                Title = "Редактировать КИМ";
            }
            else
            {
                Exam = new Exam { DurationMinutes = 90 };
                Title = "Новый КИМ";
            }
            DataContext = Exam;
        }

        private async void SaveButton_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(Exam.Title))
            {
                MessageBox.Show("Введите название КИМ.", "Ошибка", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            using var ctx = new AppDbContext();
            if (_isEdit)
            {
                var existing = await ctx.Exams.FindAsync(Exam.Id);
                if (existing != null)
                {
                    existing.Title = Exam.Title;
                    existing.Description = Exam.Description;
                    existing.DurationMinutes = Exam.DurationMinutes;
                    await ctx.SaveChangesAsync();
                }
            }
            else
            {
                ctx.Exams.Add(Exam);
                await ctx.SaveChangesAsync();
            }

            DialogResult = true;
            Close();
        }

        private void CancelButton_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
        }
    }
}
