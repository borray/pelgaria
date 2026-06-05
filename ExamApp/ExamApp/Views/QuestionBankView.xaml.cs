using ExamApp.Dialogs;
using ExamApp.Models;
using ExamApp.ViewModels;
using System.Windows;
using System.Windows.Controls;

namespace ExamApp.Views
{
    public partial class QuestionBankView : UserControl
    {
        private QuestionBankViewModel VM => (QuestionBankViewModel)DataContext;

        public QuestionBankView()
        {
            InitializeComponent();
        }

        private async void UserControl_Loaded(object sender, RoutedEventArgs e)
        {
            await VM.LoadDataAsync();
        }

        private void AddTopic_Click(object sender, RoutedEventArgs e)
        {
            var dlg = new EditTopicDialog { Owner = Window.GetWindow(this) };
            if (dlg.ShowDialog() == true)
                _ = VM.RefreshAsync();
        }

        private void EditTopic_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is Topic topic)
            {
                var dlg = new EditTopicDialog(topic) { Owner = Window.GetWindow(this) };
                if (dlg.ShowDialog() == true)
                    _ = VM.RefreshAsync();
            }
        }

        private void DeleteTopic_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is Topic topic)
            {
                var result = MessageBox.Show(
                    $"Удалить тему «{topic.Name}»?\nВсе вопросы этой темы не будут удалены.",
                    "Подтверждение", MessageBoxButton.YesNo, MessageBoxImage.Warning);
                if (result == MessageBoxResult.Yes)
                    _ = VM.DeleteTopicAsync(topic);
            }
        }

        private void AddQuestion_Click(object sender, RoutedEventArgs e)
        {
            var dlg = new EditQuestionDialog { Owner = Window.GetWindow(this) };
            if (dlg.ShowDialog() == true)
                _ = VM.RefreshAsync();
        }

        private void EditQuestion_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is Question q)
            {
                var dlg = new EditQuestionDialog(q) { Owner = Window.GetWindow(this) };
                if (dlg.ShowDialog() == true)
                    _ = VM.RefreshAsync();
            }
        }

        private void DeleteQuestion_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is Question q)
            {
                var result = MessageBox.Show(
                    $"Удалить вопрос?\n\"{q.Text}\"",
                    "Подтверждение", MessageBoxButton.YesNo, MessageBoxImage.Warning);
                if (result == MessageBoxResult.Yes)
                    _ = VM.DeleteQuestionAsync(q);
            }
        }
    }
}
