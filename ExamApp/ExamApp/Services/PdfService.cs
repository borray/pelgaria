using ExamApp.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System;
using System.Collections.Generic;
using System.Linq;

namespace ExamApp.Services
{
    public class PdfService
    {
        public PdfService()
        {
            QuestPDF.Settings.License = LicenseType.Community;
        }

        public string GenerateExamBlanks(Exam exam, List<Participant> participants, DateTime examDate,
            IReadOnlyDictionary<string, byte[]>? formulaImages = null)
        {
            byte[]? Formula(string? latex)
                => !string.IsNullOrWhiteSpace(latex) && formulaImages != null
                   && formulaImages.TryGetValue(latex!, out var bytes) ? bytes : null;

            var outputPath = System.IO.Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
                $"ExamBlanks_{exam.Title.Replace(" ", "_")}_{examDate:yyyyMMdd}.pdf");

            var orderedQuestions = exam.ExamQuestions
                .OrderBy(eq => eq.Order)
                .Select(eq => eq.Question!)
                .ToList();

            Document.Create(container =>
            {
                foreach (var participant in participants)
                {
                    // Cover page
                    container.Page(page =>
                    {
                        page.Size(PageSizes.A4);
                        page.Margin(2, Unit.Centimetre);
                        page.DefaultTextStyle(x => x.FontFamily("Arial").FontSize(11));

                        page.Content().Column(col =>
                        {
                            col.Item().AlignCenter().Text("КОНТРОЛЬНО-ИЗМЕРИТЕЛЬНЫЕ МАТЕРИАЛЫ")
                                .Bold().FontSize(16);

                            col.Item().PaddingTop(10).AlignCenter().Text(exam.Title)
                                .Bold().FontSize(14);

                            col.Item().PaddingTop(20).LineHorizontal(1);

                            col.Item().PaddingTop(15).Table(table =>
                            {
                                table.ColumnsDefinition(cols =>
                                {
                                    cols.RelativeColumn(2);
                                    cols.RelativeColumn(3);
                                });

                                table.Cell().Padding(5).Text("Участник:").Bold();
                                table.Cell().Padding(5).Text(participant.FullName);

                                table.Cell().Padding(5).Text("Группа:").Bold();
                                table.Cell().Padding(5).Text(participant.GroupName);

                                table.Cell().Padding(5).Text("Дата:").Bold();
                                table.Cell().Padding(5).Text(examDate.ToString("dd.MM.yyyy"));

                                table.Cell().Padding(5).Text("Длительность:").Bold();
                                table.Cell().Padding(5).Text($"{exam.DurationMinutes} минут");

                                table.Cell().Padding(5).Text("Макс. баллов:").Bold();
                                table.Cell().Padding(5).Text(orderedQuestions.Sum(q => q.MaxScore).ToString());
                            });

                            if (!string.IsNullOrWhiteSpace(exam.Description))
                            {
                                col.Item().PaddingTop(15).Background(Colors.Grey.Lighten4)
                                    .Padding(10)
                                    .Text(exam.Description).FontSize(10).Italic();
                            }

                            col.Item().PaddingTop(20).LineHorizontal(1);

                            col.Item().PaddingTop(10).Text("Инструкция:")
                                .Bold().FontSize(12);

                            col.Item().PaddingTop(5).Text(
                                "Внимательно прочитайте каждый вопрос. Для вопросов с выбором ответа " +
                                "отметьте один или несколько правильных вариантов в бланке ответов. " +
                                "Для вопросов с развёрнутым ответом запишите ответ в отведённом месте.")
                                .FontSize(10);

                            col.Item().PaddingTop(20).AlignCenter()
                                .Text($"Всего вопросов: {orderedQuestions.Count}")
                                .FontSize(12);
                        });
                    });

                    // Exam questions pages
                    container.Page(page =>
                    {
                        page.Size(PageSizes.A4);
                        page.Margin(2, Unit.Centimetre);
                        page.DefaultTextStyle(x => x.FontFamily("Arial").FontSize(11));

                        page.Header().Column(col =>
                        {
                            col.Item().Row(row =>
                            {
                                row.RelativeItem().Text(exam.Title).Bold().FontSize(12);
                                row.ConstantItem(200).AlignRight()
                                    .Text($"{participant.FullName} / {participant.GroupName}")
                                    .FontSize(9).FontColor(Colors.Grey.Darken2);
                            });
                            col.Item().LineHorizontal(0.5f).LineColor(Colors.Grey.Medium);
                            col.Item().PaddingTop(5);
                        });

                        page.Content().Column(col =>
                        {
                            var questionNumber = 1;
                            foreach (var question in orderedQuestions)
                            {
                                col.Item().PaddingTop(10).Column(qCol =>
                                {
                                    qCol.Item().Row(row =>
                                    {
                                        row.ConstantItem(30).Text($"{questionNumber}.").Bold();
                                        row.RelativeItem().Text(question.Text);
                                        row.ConstantItem(80).AlignRight()
                                            .Text($"[{question.MaxScore} б.]")
                                            .FontSize(9).FontColor(Colors.Grey.Darken1);
                                    });

                                    // Формула вопроса
                                    var qFormula = Formula(question.Formula);
                                    if (qFormula != null)
                                        qCol.Item().PaddingLeft(30).PaddingTop(3).AlignLeft()
                                            .MaxHeight(36).Image(qFormula).FitHeight();

                                    // Картинки вопроса
                                    foreach (var img in question.Images.OrderBy(i => i.Order))
                                    {
                                        if (img.ImageData.Length > 0)
                                            qCol.Item().PaddingLeft(30).PaddingTop(5).AlignLeft()
                                                .MaxWidth(260).Image(img.ImageData).FitWidth();
                                    }

                                    if (question.Type == QuestionType.FreeForm)
                                    {
                                        qCol.Item().PaddingLeft(30).PaddingTop(5).Column(lineCol =>
                                        {
                                            for (int i = 0; i < 4; i++)
                                            {
                                                lineCol.Item().PaddingTop(8).LineHorizontal(0.5f)
                                                    .LineColor(Colors.Grey.Medium);
                                            }
                                        });
                                    }
                                    else
                                    {
                                        var options = question.AnswerOptions.OrderBy(a => a.Order).ToList();
                                        var letters = "АБВГДЕЖЗ";
                                        qCol.Item().PaddingLeft(30).PaddingTop(5).Column(optCol =>
                                        {
                                            for (int i = 0; i < options.Count; i++)
                                            {
                                                var opt = options[i];
                                                optCol.Item().PaddingTop(2).Row(optRow =>
                                                {
                                                    optRow.ConstantItem(20)
                                                        .Text(i < letters.Length ? $"{letters[i]})" : $"{i + 1})")
                                                        .FontSize(10);
                                                    optRow.RelativeItem().Column(oc =>
                                                    {
                                                        if (!string.IsNullOrWhiteSpace(opt.Text))
                                                            oc.Item().Text(opt.Text).FontSize(10);

                                                        var oFormula = Formula(opt.Formula);
                                                        if (oFormula != null)
                                                            oc.Item().PaddingTop(1).AlignLeft()
                                                                .MaxHeight(26).Image(oFormula).FitHeight();

                                                        if (opt.ImageData != null && opt.ImageData.Length > 0)
                                                            oc.Item().PaddingTop(2).AlignLeft()
                                                                .MaxWidth(180).Image(opt.ImageData).FitWidth();
                                                    });
                                                });
                                            }
                                        });
                                    }
                                });

                                questionNumber++;
                                col.Item().PaddingTop(5).LineHorizontal(0.3f).LineColor(Colors.Grey.Lighten2);
                            }
                        });

                        page.Footer().AlignCenter()
                            .Text(text =>
                            {
                                text.Span("Страница ").FontSize(9).FontColor(Colors.Grey.Medium);
                                text.CurrentPageNumber().FontSize(9).FontColor(Colors.Grey.Medium);
                                text.Span(" из ").FontSize(9).FontColor(Colors.Grey.Medium);
                                text.TotalPages().FontSize(9).FontColor(Colors.Grey.Medium);
                            });
                    });

                    // Answer sheet (бланк ответов)
                    container.Page(page =>
                    {
                        page.Size(PageSizes.A4);
                        page.Margin(2, Unit.Centimetre);
                        page.DefaultTextStyle(x => x.FontFamily("Arial").FontSize(11));

                        page.Content().Column(col =>
                        {
                            col.Item().AlignCenter().Text("БЛАНК ОТВЕТОВ")
                                .Bold().FontSize(16);

                            col.Item().PaddingTop(5).AlignCenter().Text(exam.Title)
                                .FontSize(12);

                            col.Item().PaddingTop(10).Table(table =>
                            {
                                table.ColumnsDefinition(cols =>
                                {
                                    cols.RelativeColumn(2);
                                    cols.RelativeColumn(3);
                                    cols.RelativeColumn(2);
                                    cols.RelativeColumn(3);
                                });

                                table.Cell().Padding(4).Text("Участник:").Bold();
                                table.Cell().Padding(4).BorderBottom(0.5f).Text(participant.FullName);
                                table.Cell().Padding(4).Text("Группа:").Bold();
                                table.Cell().Padding(4).BorderBottom(0.5f).Text(participant.GroupName);
                                table.Cell().Padding(4).Text("Дата:").Bold();
                                table.Cell().Padding(4).BorderBottom(0.5f).Text(examDate.ToString("dd.MM.yyyy"));
                                table.Cell().Padding(4).Text("Вариант:").Bold();
                                table.Cell().Padding(4).BorderBottom(0.5f).Text("_______");
                            });

                            col.Item().PaddingTop(15).LineHorizontal(1);
                            col.Item().PaddingTop(10).Text("Задания с выбором ответа:")
                                .Bold().FontSize(12);

                            col.Item().PaddingTop(8).Table(answerTable =>
                            {
                                var maxOptions = 8;
                                var letters = "АБВГДЕЖЗ";

                                answerTable.ColumnsDefinition(cols =>
                                {
                                    cols.ConstantColumn(35); // question number
                                    for (int i = 0; i < maxOptions; i++)
                                        cols.ConstantColumn(30); // one per option letter
                                    cols.RelativeColumn(); // score
                                });

                                // Header row
                                answerTable.Cell().Border(0.5f).Background(Colors.Grey.Lighten3)
                                    .Padding(4).AlignCenter().Text("№").Bold().FontSize(9);
                                for (int i = 0; i < maxOptions; i++)
                                {
                                    answerTable.Cell().Border(0.5f).Background(Colors.Grey.Lighten3)
                                        .Padding(4).AlignCenter()
                                        .Text(letters[i].ToString()).Bold().FontSize(9);
                                }
                                answerTable.Cell().Border(0.5f).Background(Colors.Grey.Lighten3)
                                    .Padding(4).AlignCenter().Text("Балл").Bold().FontSize(9);

                                var questionNumber = 1;
                                foreach (var question in orderedQuestions)
                                {
                                    if (question.Type == QuestionType.FreeForm)
                                    {
                                        questionNumber++;
                                        continue;
                                    }

                                    var optionCount = question.AnswerOptions.Count;

                                    answerTable.Cell().Border(0.5f).Padding(4).AlignCenter()
                                        .Text(questionNumber.ToString()).FontSize(9);

                                    for (int i = 0; i < maxOptions; i++)
                                    {
                                        if (i < optionCount)
                                        {
                                            answerTable.Cell().Border(0.5f).Padding(4).AlignCenter()
                                                .Text("O").FontSize(14).FontColor(Colors.Grey.Lighten1);
                                        }
                                        else
                                        {
                                            answerTable.Cell().Border(0.5f).Background(Colors.Grey.Lighten4)
                                                .Text("");
                                        }
                                    }

                                    answerTable.Cell().Border(0.5f).Padding(4).Text("");
                                    questionNumber++;
                                }
                            });

                            col.Item().PaddingTop(15).Text("Задания с развёрнутым ответом:")
                                .Bold().FontSize(12);

                            col.Item().PaddingTop(8).Table(freeTable =>
                            {
                                freeTable.ColumnsDefinition(cols =>
                                {
                                    cols.ConstantColumn(35);
                                    cols.RelativeColumn();
                                    cols.ConstantColumn(60);
                                });

                                freeTable.Cell().Border(0.5f).Background(Colors.Grey.Lighten3)
                                    .Padding(4).AlignCenter().Text("№").Bold().FontSize(9);
                                freeTable.Cell().Border(0.5f).Background(Colors.Grey.Lighten3)
                                    .Padding(4).Text("Ответ эксперта").Bold().FontSize(9);
                                freeTable.Cell().Border(0.5f).Background(Colors.Grey.Lighten3)
                                    .Padding(4).AlignCenter().Text("Балл").Bold().FontSize(9);

                                var questionNumber2 = 1;
                                foreach (var question in orderedQuestions)
                                {
                                    if (question.Type != QuestionType.FreeForm)
                                    {
                                        questionNumber2++;
                                        continue;
                                    }

                                    freeTable.Cell().Border(0.5f).Padding(4).AlignCenter()
                                        .Text(questionNumber2.ToString()).FontSize(9);
                                    freeTable.Cell().Border(0.5f).MinHeight(50).Padding(4).Text("");
                                    freeTable.Cell().Border(0.5f).Padding(4).Text("");

                                    questionNumber2++;
                                }
                            });

                            col.Item().PaddingTop(15).LineHorizontal(0.5f);
                            col.Item().PaddingTop(5).Row(row =>
                            {
                                row.RelativeItem().Text("Итого баллов: _______").Bold();
                                row.RelativeItem().AlignRight()
                                    .Text($"Максимум: {orderedQuestions.Sum(q => q.MaxScore)}").Bold();
                            });

                            col.Item().PaddingTop(10).Row(row =>
                            {
                                row.RelativeItem()
                                    .Text("Подпись проверяющего: ___________________________");
                            });
                        });
                    });
                }
            }).GeneratePdf(outputPath);

            return outputPath;
        }
    }
}
