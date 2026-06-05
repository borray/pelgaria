using ExamApp.ViewModels;
using System.Windows;
using System.Windows.Controls;

namespace ExamApp.Views
{
    public partial class PrintView : UserControl
    {
        private PrintViewModel VM => (PrintViewModel)DataContext;

        public PrintView()
        {
            InitializeComponent();
        }

        private async void UserControl_Loaded(object sender, RoutedEventArgs e)
        {
            await VM.LoadDataAsync();
        }

        private void SelectAll_Click(object sender, RoutedEventArgs e)
        {
            foreach (var p in VM.Participants)
                p.IsSelected = true;
        }

        private void DeselectAll_Click(object sender, RoutedEventArgs e)
        {
            foreach (var p in VM.Participants)
                p.IsSelected = false;
        }

        private async void GeneratePdf_Click(object sender, RoutedEventArgs e)
        {
            await VM.GeneratePdfAsync();
        }

        private void OpenPdf_Click(object sender, RoutedEventArgs e)
        {
            VM.OpenPdf();
        }
    }
}
