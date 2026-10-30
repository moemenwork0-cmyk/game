#include "SWarTouchControls.h"
#include "WarCharacter.h"
#include "Engine/Texture2D.h"
#include "Fonts/SlateFontInfo.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "Rendering/DrawElements.h"
#include "Styling/CoreStyle.h"

namespace
{
	const FVector2D LayoutSize(1200.f, 540.f);
	const float StickRadius = 85.f;
	const float KnobRadius = 35.f;

	FSlateBrush MakeCircle(const FLinearColor& Fill, const FLinearColor& Outline, float OutlineWidth)
	{
		FSlateBrush Brush;
		Brush.DrawAs = ESlateBrushDrawType::RoundedBox;
		Brush.TintColor = Fill;
		Brush.OutlineSettings.Color = Outline;
		Brush.OutlineSettings.Width = OutlineWidth;
		Brush.OutlineSettings.RoundingType = ESlateBrushRoundingType::HalfHeightRadius;
		return Brush;
	}
}

void SWarTouchControls::Construct(const FArguments& InArgs)
{
	Controller = InArgs._Controller;
	Disc = MakeCircle(FLinearColor(0.06f, 0.07f, 0.08f, 0.38f), FLinearColor(1.f, 1.f, 1.f, 0.35f), 1.5f);
	Halo = MakeCircle(FLinearColor::Transparent, FLinearColor(1.f, 1.f, 1.f, 0.22f), 1.f);
	Ring = MakeCircle(FLinearColor(1.f, 1.f, 1.f, 0.22f), FLinearColor(1.f, 1.f, 1.f, 0.55f), 1.5f);

	// Same layout as Docs/hud_mockup.png.
	auto Add = [this](FName Id, const TCHAR* Label, FVector2D Offset, float Radius, bool bLeft = false, bool bToggle = false)
	{
		FButton& B = Buttons.AddDefaulted_GetRef();
		B.Id = Id;
		B.Label = Label;
		B.Offset = Offset;
		B.Radius = Radius;
		B.bLeft = bLeft;
		B.bToggle = bToggle;
		const FString Path = FString::Printf(TEXT("/Game/UI/Icons/T_%s.T_%s"), *Id.ToString(), *Id.ToString());
		B.Texture = LoadObject<UTexture2D>(nullptr, *Path);
		B.Icon.SetResourceObject(B.Texture);
		B.Icon.ImageSize = FVector2D(256.f, 256.f);
	};
	Add("fire", TEXT(""), FVector2D(112.f, 112.f), 60.f);
	Add("aim", TEXT("AIM"), FVector2D(228.f, 190.f), 34.f, false, true);
	Add("jump", TEXT("JUMP"), FVector2D(92.f, 242.f), 31.f);
	Add("crouch", TEXT("CROUCH"), FVector2D(170.f, 290.f), 28.f, false, true);
	Add("reload", TEXT("RELOAD"), FVector2D(52.f, 330.f), 26.f);
	Add("grenade", TEXT("GRENADE"), FVector2D(316.f, 236.f), 26.f);
	Add("sprint", TEXT("SPRINT"), FVector2D(300.f, 84.f), 27.f, true, true);
	// Second trigger on the left so the player can shoot while steering with the right thumb.
	Add("fire", TEXT(""), FVector2D(268.f, 222.f), 25.f, true);
	Add("pause", TEXT(""), FVector2D(38.f, 504.f), 20.f);
}

void SWarTouchControls::AddReferencedObjects(FReferenceCollector& Collector)
{
	for (FButton& B : Buttons)
	{
		Collector.AddReferencedObject(B.Texture);
	}
}

float SWarTouchControls::LayoutScale(const FGeometry& Geometry) const
{
	const FVector2D Size = Geometry.GetLocalSize();
	return FMath::Min(Size.X / LayoutSize.X, Size.Y / LayoutSize.Y);
}

FVector2D SWarTouchControls::ButtonCentre(const FGeometry& Geometry, const FButton& Button) const
{
	const FVector2D Size = Geometry.GetLocalSize();
	const FVector2D Off = Button.Offset * LayoutScale(Geometry);
	return Button.bLeft ? FVector2D(Off.X, Size.Y - Off.Y) : FVector2D(Size.X - Off.X, Size.Y - Off.Y);
}

SWarTouchControls::FButton* SWarTouchControls::HitButton(const FGeometry& Geometry, const FVector2D& Local)
{
	const float Scale = LayoutScale(Geometry);
	for (FButton& B : Buttons)
	{
		// A little slack around each button: thumbs are not precise.
		if (FVector2D::Distance(Local, ButtonCentre(Geometry, B)) <= (B.Radius + 8.f) * Scale)
		{
			return &B;
		}
	}
	return nullptr;
}

AWarCharacter* SWarTouchControls::GetSoldier() const
{
	return Controller.IsValid() ? Cast<AWarCharacter>(Controller->GetPawn()) : nullptr;
}

void SWarTouchControls::Press(FButton& Button, bool bDown)
{
	if (Button.bToggle)
	{
		if (!bDown)
		{
			return;
		}
		Button.bOn = !Button.bOn;
	}
	else
	{
		Button.bOn = bDown;
	}

	AWarCharacter* Soldier = GetSoldier();
	if (Button.Id == "pause" && bDown && Controller.IsValid())
	{
		UGameplayStatics::SetGamePaused(Controller.Get(), !UGameplayStatics::IsGamePaused(Controller.Get()));
	}
	if (!Soldier)
	{
		return;
	}
	if (Button.Id == "jump" && bDown)
	{
		Soldier->Jump();
	}
	else if (Button.Id == "crouch")
	{
		Soldier->ToggleCrouch();
	}
	else if (Button.Id == "sprint")
	{
		Soldier->SetSprinting(Button.bOn);
	}
	else if (Button.Id == "aim")
	{
		Soldier->SetAiming(Button.bOn);
	}
	// fire / reload / grenade are wired up with the weapon in the next part.
}

FReply SWarTouchControls::OnTouchStarted(const FGeometry& MyGeometry, const FPointerEvent& Event)
{
	const FVector2D Local = MyGeometry.AbsoluteToLocal(Event.GetScreenSpacePosition());
	const int32 Pointer = Event.GetPointerIndex();

	if (FButton* B = HitButton(MyGeometry, Local))
	{
		B->Pointer = Pointer;
		FireLast = Local;
		Press(*B, true);
	}
	else if (Local.X < MyGeometry.GetLocalSize().X * 0.4f && MovePointer == INDEX_NONE)
	{
		MovePointer = Pointer;
		MoveOrigin = Local;
		MoveKnob = FVector2D::ZeroVector;
	}
	else if (LookPointer == INDEX_NONE)
	{
		LookPointer = Pointer;
		LookLast = Local;
	}
	return FReply::Handled();
}

FReply SWarTouchControls::OnTouchMoved(const FGeometry& MyGeometry, const FPointerEvent& Event)
{
	const FVector2D Local = MyGeometry.AbsoluteToLocal(Event.GetScreenSpacePosition());
	const int32 Pointer = Event.GetPointerIndex();
	AWarCharacter* Soldier = GetSoldier();

	if (Pointer == MovePointer)
	{
		const float Max = StickRadius * LayoutScale(MyGeometry);
		MoveKnob = (Local - MoveOrigin).GetClampedToMaxSize(Max);
		if (Soldier)
		{
			Soldier->SetMoveInput(FVector2D(MoveKnob.X, -MoveKnob.Y) / Max);
		}
	}
	else if (Pointer == LookPointer)
	{
		if (Soldier)
		{
			Soldier->AddLookInput(Local - LookLast);
		}
		LookLast = Local;
	}
	else
	{
		// Dragging while holding fire also turns the view, like on console-style mobile shooters.
		for (const FButton& B : Buttons)
		{
			if (B.Pointer == Pointer && B.Id == "fire")
			{
				if (Soldier)
				{
					Soldier->AddLookInput(Local - FireLast);
				}
				FireLast = Local;
			}
		}
	}
	return FReply::Handled();
}

FReply SWarTouchControls::OnTouchEnded(const FGeometry& MyGeometry, const FPointerEvent& Event)
{
	const int32 Pointer = Event.GetPointerIndex();
	if (Pointer == MovePointer)
	{
		MovePointer = INDEX_NONE;
		MoveKnob = FVector2D::ZeroVector;
		if (AWarCharacter* Soldier = GetSoldier())
		{
			Soldier->SetMoveInput(FVector2D::ZeroVector);
		}
	}
	if (Pointer == LookPointer)
	{
		LookPointer = INDEX_NONE;
	}
	for (FButton& B : Buttons)
	{
		if (B.Pointer == Pointer)
		{
			B.Pointer = INDEX_NONE;
			Press(B, false);
		}
	}
	return FReply::Handled();
}

int32 SWarTouchControls::OnPaint(const FPaintArgs& Args, const FGeometry& AllottedGeometry, const FSlateRect& MyCullingRect,
	FSlateWindowElementList& OutDrawElements, int32 LayerId, const FWidgetStyle& InWidgetStyle, bool bParentEnabled) const
{
	const float Scale = LayoutScale(AllottedGeometry);
	auto Box = [&](const FSlateBrush& Brush, FVector2D Centre, float Radius, int32 Layer, FLinearColor Tint)
	{
		const FVector2D Size(Radius * 2.f, Radius * 2.f);
		FSlateDrawElement::MakeBox(OutDrawElements, Layer,
			AllottedGeometry.ToPaintGeometry(Size, FSlateLayoutTransform(Centre - Size * 0.5f)),
			&Brush, ESlateDrawEffect::None, Brush.TintColor.GetSpecifiedColor() * Tint);
	};

	// Move stick: a resting position bottom-left, or wherever the thumb landed.
	const FVector2D Size = AllottedGeometry.GetLocalSize();
	const FVector2D StickCentre = MovePointer != INDEX_NONE ? MoveOrigin : FVector2D(155.f * Scale, Size.Y - 135.f * Scale);
	Box(Disc, StickCentre, StickRadius * Scale, LayerId, FLinearColor::White);
	Box(Halo, StickCentre, StickRadius * Scale, LayerId, FLinearColor::White);
	Box(Ring, StickCentre + MoveKnob, KnobRadius * Scale, LayerId + 1, FLinearColor::White);

	FSlateFontInfo Font = FCoreStyle::GetDefaultFontStyle("Bold", FMath::RoundToInt(9.f * Scale));
	Font.LetterSpacing = 160;
	for (const FButton& B : Buttons)
	{
		const FVector2D C = ButtonCentre(AllottedGeometry, B);
		const float R = B.Radius * Scale;
		const FLinearColor Tint = B.bOn ? FLinearColor(1.f, 0.78f, 0.36f, 1.f) : FLinearColor::White;
		Box(Disc, C, R, LayerId, B.bOn ? FLinearColor(2.f, 1.6f, 1.f, 1.4f) : FLinearColor::White);
		if (B.Id == "fire" && B.Radius > 40.f)
		{
			// The main trigger gets a faint outer ring so the thumb finds it without looking.
			Box(Halo, C, R + 7.f * Scale, LayerId, FLinearColor::White);
		}
		if (B.Texture)
		{
			const float IconRadius = R * (B.Id == "fire" ? 0.48f : 0.52f);
			const FVector2D IconSize(IconRadius * 2.f, IconRadius * 2.f);
			FSlateDrawElement::MakeBox(OutDrawElements, LayerId + 1,
				AllottedGeometry.ToPaintGeometry(IconSize, FSlateLayoutTransform(C - IconSize * 0.5f)),
				&B.Icon, ESlateDrawEffect::None, Tint * FLinearColor(1.f, 1.f, 1.f, 0.95f));
		}
		if (!B.Label.IsEmpty())
		{
			FSlateDrawElement::MakeText(OutDrawElements, LayerId + 1,
				AllottedGeometry.ToPaintGeometry(FVector2D(R * 4.f, 14.f * Scale),
					FSlateLayoutTransform(FVector2D(C.X - R * 0.8f, C.Y + R + 3.f * Scale))),
				B.Label, Font, ESlateDrawEffect::None, FLinearColor(1.f, 1.f, 1.f, 0.75f));
		}
	}
	return LayerId + 2;
}
