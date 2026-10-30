#pragma once

#include "Styling/SlateBrush.h"
#include "UObject/GCObject.h"
#include "Widgets/SLeafWidget.h"

class APlayerController;
class UTexture2D;

// Full-screen mobile controls drawn in Slate: a floating move stick on the left, drag-to-look on
// the right, and round icon buttons. Icons are the textures under /Game/UI/Icons.
class SWarTouchControls : public SLeafWidget, public FGCObject
{
public:
	SLATE_BEGIN_ARGS(SWarTouchControls) {}
		SLATE_ARGUMENT(APlayerController*, Controller)
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);

	virtual FVector2D ComputeDesiredSize(float) const override { return FVector2D(1200.f, 540.f); }
	virtual int32 OnPaint(const FPaintArgs& Args, const FGeometry& AllottedGeometry, const FSlateRect& MyCullingRect,
		FSlateWindowElementList& OutDrawElements, int32 LayerId, const FWidgetStyle& InWidgetStyle, bool bParentEnabled) const override;
	virtual FReply OnTouchStarted(const FGeometry& MyGeometry, const FPointerEvent& Event) override;
	virtual FReply OnTouchMoved(const FGeometry& MyGeometry, const FPointerEvent& Event) override;
	virtual FReply OnTouchEnded(const FGeometry& MyGeometry, const FPointerEvent& Event) override;
	virtual bool SupportsKeyboardFocus() const override { return true; }

	virtual void AddReferencedObjects(FReferenceCollector& Collector) override;
	virtual FString GetReferencerName() const override { return TEXT("SWarTouchControls"); }

private:
	struct FButton
	{
		FName Id;
		FString Label;
		// Centre in layout units (1200 x 540 reference), measured from the bottom-right corner,
		// or from the bottom-left when bLeft is set.
		FVector2D Offset;
		float Radius = 30.f;
		bool bLeft = false;
		bool bToggle = false;
		TObjectPtr<UTexture2D> Texture = nullptr;
		FSlateBrush Icon;
		int32 Pointer = INDEX_NONE;
		bool bOn = false;
	};

	float LayoutScale(const FGeometry& Geometry) const;
	FVector2D ButtonCentre(const FGeometry& Geometry, const FButton& Button) const;
	FButton* HitButton(const FGeometry& Geometry, const FVector2D& Local);
	void Press(FButton& Button, bool bDown);
	class AWarCharacter* GetSoldier() const;

	TWeakObjectPtr<APlayerController> Controller;
	TArray<FButton> Buttons;
	FSlateBrush Disc;
	FSlateBrush Ring;
	FSlateBrush Halo;

	int32 MovePointer = INDEX_NONE;
	FVector2D MoveOrigin = FVector2D::ZeroVector;
	FVector2D MoveKnob = FVector2D::ZeroVector;
	int32 LookPointer = INDEX_NONE;
	FVector2D LookLast = FVector2D::ZeroVector;
	FVector2D FireLast = FVector2D::ZeroVector;
};
