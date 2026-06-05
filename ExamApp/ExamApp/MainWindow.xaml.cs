using ExamApp.Services;
using ExamApp.ViewModels;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace ExamApp
{
    public partial class MainWindow : Window
    {
        private readonly MainViewModel _vm = new();
        private readonly UpdateService _updateService = new();
        private Button? _activeNavButton;
        private UpdateInfo? _pendingUpdate;

        public MainWindow()
        {
            InitializeComponent();

            QuestionBankView.DataContext = _vm.QuestionBankVM;
            ExamFormationView.DataContext = _vm.ExamFormationVM;
            ParticipantsView.DataContext = _vm.ParticipantsVM;
            PrintView.DataContext = _vm.PrintVM;
            ResultsView.DataContext = _vm.ResultsVM;

            SetActiveNav(NavQuestionBank);
        }

        protected override async void OnContentRendered(EventArgs e)
        {
            base.OnContentRendered(e);
            await CheckForUpdatesAsync();
        }

        private async Task CheckForUpdatesAsync()
        {
            try
            {
                if (_updateService.IsDevBuild)
                {
                    UpdateStatusText.Text = "Локальная сборка";
                    return;
                }

                _pendingUpdate = await _updateService.CheckForUpdateAsync();

                if (_pendingUpdate is not null)
                {
                    UpdateStatusText.Text = $"Доступно обновление\n{_pendingUpdate.TagName}";
                    UpdateStatusText.Foreground = new SolidColorBrush(Color.FromRgb(0xFF, 0xA0, 0x00));
                    UpdateButton.Visibility = Visibility.Visible;
                }
                else
                {
                    UpdateStatusText.Text = $"Версия {BuildInfo.Version}";
                }
            }
            catch
            {
                // Нет интернета или приватный репозиторий — просто показываем версию.
                UpdateStatusText.Text = $"Версия {BuildInfo.Version}";
            }
        }

        private async void UpdateButton_Click(object sender, RoutedEventArgs e)
        {
            if (_pendingUpdate is null) return;

            var confirm = MessageBox.Show(
                $"Установить обновление {_pendingUpdate.TagName}?\n\nПриложение перезапустится автоматически.",
                "Обновление", MessageBoxButton.YesNo, MessageBoxImage.Question);

            if (confirm != MessageBoxResult.Yes) return;

            UpdateButton.IsEnabled = false;

            try
            {
                var progress = new Progress<int>(p =>
                    Dispatcher.Invoke(() => UpdateStatusText.Text = $"Скачивание {p}%..."));

                await _updateService.DownloadAndInstallAsync(_pendingUpdate, progress);
                // App shuts down inside DownloadAndInstallAsync
            }
            catch (Exception ex)
            {
                UpdateStatusText.Text = "Ошибка обновления";
                UpdateButton.IsEnabled = true;
                MessageBox.Show($"Не удалось загрузить обновление:\n{ex.Message}",
                    "Ошибка", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private async void NavButton_Click(object sender, RoutedEventArgs e)
        {
            if (sender is not Button btn) return;

            var tag = btn.Tag?.ToString();
            SetActiveNav(btn);

            QuestionBankView.Visibility = tag == "QuestionBank" ? Visibility.Visible : Visibility.Collapsed;
            ExamFormationView.Visibility = tag == "ExamFormation" ? Visibility.Visible : Visibility.Collapsed;
            ParticipantsView.Visibility = tag == "Participants" ? Visibility.Visible : Visibility.Collapsed;
            PrintView.Visibility = tag == "Print" ? Visibility.Visible : Visibility.Collapsed;
            ResultsView.Visibility = tag == "Results" ? Visibility.Visible : Visibility.Collapsed;

            // Перезагружаем данные раздела, чтобы видеть всё, что создано в других разделах.
            await RefreshSectionAsync(tag);
        }

        private async Task RefreshSectionAsync(string? tag)
        {
            try
            {
                switch (tag)
                {
                    case "QuestionBank": await _vm.QuestionBankVM.RefreshAsync(); break;
                    case "ExamFormation": await _vm.ExamFormationVM.RefreshAsync(); break;
                    case "Participants": await _vm.ParticipantsVM.RefreshAsync(); break;
                    case "Print": await _vm.PrintVM.RefreshAsync(); break;
                    case "Results": await _vm.ResultsVM.RefreshAsync(); break;
                }
            }
            catch { /* обновление не критично для навигации */ }
        }

        private void SetActiveNav(Button button)
        {
            if (_activeNavButton != null)
                _activeNavButton.Background = Brushes.Transparent;

            button.Background = new SolidColorBrush(Color.FromRgb(0x15, 0x65, 0xC0));
            _activeNavButton = button;
        }
    }
}
