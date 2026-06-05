using ExamApp.Data;
using ExamApp.Models;
using System.Windows;

namespace ExamApp.Dialogs
{
    public partial class EditTopicDialog : Window
    {
        public Topic Topic { get; private set; } = null!;
        private bool _isEdit;

        public EditTopicDialog(Topic? existing = null)
        {
            InitializeComponent();
            if (existing != null)
            {
                _isEdit = true;
                Topic = new Topic { Id = existing.Id, Name = existing.Name, Description = existing.Description };
                Title = "Редактировать тему";
            }
            else
            {
                Topic = new Topic();
                Title = "Новая тема";
            }
            DataContext = Topic;
        }

        private async void SaveButton_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(Topic.Name))
            {
                MessageBox.Show("Введите название темы.", "Ошибка", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            using var ctx = new AppDbContext();
            if (_isEdit)
            {
                var existing = await ctx.Topics.FindAsync(Topic.Id);
                if (existing != null)
                {
                    existing.Name = Topic.Name;
                    existing.Description = Topic.Description;
                    await ctx.SaveChangesAsync();
                }
            }
            else
            {
                ctx.Topics.Add(Topic);
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
