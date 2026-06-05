using ExamApp.Dialogs;
using ExamApp.Models;
using ExamApp.ViewModels;
using System;
using System.Windows;
using System.Windows.Controls;

namespace ExamApp.Views
{
    public partial class ExamFormationView : UserControl
    {
        private ExamFormationViewModel VM => (ExamFormationViewModel)DataContext;

        public ExamFormationView()
        {
            InitializeComponent();
        }

        private async void UserControl_Loaded(object sender, RoutedEventArgs e)
        {
            await VM.LoadDataAsync();
        }

        private void AddExam_Click(object sender, RoutedEventArgs e)
        {
            var dlg = new EditExamDialog { Owner = Window.GetWindow(this) };
            if (dlg.ShowDialog() == true)
                _ = VM.RefreshAsync();
        }

        private void EditExam_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is Exam exam)
            {
                var dlg = new EditExamDialog(exam) { Owner = Window.GetWindow(this) };
                if (dlg.ShowDialog() == true)
                    _ = VM.RefreshAsync();
            }
        }

        private void DeleteExam_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is Exam exam)
            {
                var result = MessageBox.Show(
                    $"Удалить КИМ «{exam.Title}»?",
                    "Подтверждение", MessageBoxButton.YesNo, MessageBoxImage.Warning);
                if (result == MessageBoxResult.Yes)
                    _ = VM.DeleteExamAsync(exam);
            }
        }

        private void AddQuestionToExam_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is Question q)
                _ = VM.AddQuestionToExamAsync(q);
        }

        private void RemoveQuestion_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is ExamQuestion eq)
                _ = VM.RemoveQuestionFromExamAsync(eq);
        }

        private void MoveUp_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is ExamQuestion eq)
                _ = VM.MoveUpAsync(eq);
        }

        private void MoveDown_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.Tag is ExamQuestion eq)
                _ = VM.MoveDownAsync(eq);
        }

        private void AddRandom_Click(object sender, RoutedEventArgs e)
        {
            if (!int.TryParse(RandomCountBox.Text, out int count) || count < 1)
            {
                MessageBox.Show("Введите корректное количество вопросов.", "Ошибка", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            int topicId = 0;
            if (RandomTopicCombo.SelectedItem is Topic t && t.Id != 0)
                topicId = t.Id;

            _ = VM.AddRandomQuestionsAsync(new Tuple<int, int>(topicId, count));
        }
    }
}
